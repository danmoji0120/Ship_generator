import {profileRing} from '../generation/hull';
import * as THREE from 'three';
import type { ShipBlueprint } from '../blueprint/types';
import type { PanelSolid } from '../generation/armor/types';
import type { InteriorInstanceState } from '../interior/types';
import { createInteriorInstanceState } from '../interior/types';
import { solidCell } from '../physical/convex';
import { analyzeInterior } from '../interior/graph';
export const INTERIOR_VIEWS = ['Compartments', 'Bulkheads', 'Openings', 'Compartment Connectivity', 'Isolation', 'Compartment Mass'] as const;
// No renderer cache retains an old ship's CSG or a second JSON identity string.
function roomSolids(b:ShipBlueprint){return new Map(b.compartmentPlan!.compartments.map(c=>[c.id,c.physicalVolume.connectedCells]));}
function mesh(parts: {
    id: string;
    solids: PanelSolid[];
    color: THREE.Color;
}[], opacity: number) { const points: number[] = [], colors: number[] = [], ranges: {
    start: number;
    end: number;
    id: string;
}[] = []; for (const p of parts) {
    const start = points.length / 9;
    for (const s of p.solids)
        for (const i of s.indices) {
            const v = s.vertices[i];
            points.push(v.x, v.y, v.z);
            colors.push(p.color.r, p.color.g, p.color.b);
        }
    ranges.push({ start, end: points.length / 9, id: p.id });
} const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: opacity < 1, opacity, side: THREE.DoubleSide, depthWrite: opacity === 1 })); m.userData.interiorRanges = ranges; return m; }
export function renderInterior(b: ShipBlueprint, mode: string, state: InteriorInstanceState = createInteriorInstanceState(), hullOpacity = .16, selected?: string) {
    const root = new THREE.Group();
    root.userData.interiorDebug = true;
    const p = b.compartmentPlan!;
    const analysis = analyzeInterior(p, state), exposed = new Set(analysis.exteriorConnectedCompartmentIds), unknown = new Set(analysis.uncertainCompartmentIds);
    if (['Compartments', 'Compartment Connectivity', 'Isolation'].includes(mode)) {
        const solids = roomSolids(b);
        root.add(mesh(p.compartments.map((c, i) => ({ id: c.id, solids: solids.get(c.id)!, color: new THREE.Color(c.id === selected ? 0xffffff : mode === 'Isolation' ? exposed.has(c.id) ? 0xff694b : unknown.has(c.id) ? 0xf2be63 : 0x69d9b3 : c.boundaryCertainty==='UNRESOLVED'?0xf2be63:new THREE.Color().setHSL(i * .173 % 1, .58, .53)) })), Math.min(.5, Math.max(.04, hullOpacity))));
    }
    if(mode==='Compartments'||mode==='Isolation'){
      const residual=p.unresolvedVoidPockets.filter(r=>r.cells?.length&&r.classification!=='ASSIGNED_RECOVERED');
      if(residual.length)root.add(mesh(residual.map(r=>({id:r.id,solids:r.cells!,color:new THREE.Color(r.classification==='NONALLOCATABLE'?0xcc76e8:r.classification==='USABLE_RESIDUAL'?0x67dcff:0xff9e52)})),.65));
    }
    const max = Math.max(1, ...p.bulkheads.map(w => w.massKg));
    root.add(mesh(p.bulkheads.filter(w => !state.disabledBulkheadIds.includes(w.id)).map(w => ({ id: w.id, solids: w.pieces, color: w.id === selected || w.adjacentCompartmentIds.includes(selected ?? '') ? new THREE.Color(0xffe5a4) : mode === 'Compartment Mass' ? new THREE.Color().setHSL(.6 - .6 * Math.log1p(w.massKg) / Math.log1p(max), .7, .55) : new THREE.Color(w.materialId==='TITANIUM_STRUCTURAL_ALLOY'?0x69c4cf:w.materialId==='LIGHT_STRUCTURAL_ALLOY'?0x849ccf:0x9a9d9a).multiplyScalar(.7+Math.min(.5,w.thicknessMm/180)) })), ['Compartments', 'Isolation', 'Compartment Connectivity'].includes(mode) ? .32 : 1));
    root.add(mesh(p.openings.filter(o => o.closure && (state.openingStates[o.id] ?? o.defaultState) !== 'OPEN' && !state.disabledBulkheadIds.includes(p.boundaries.find(b => b.id === o.boundaryReference)?.bulkheadRef ?? '')).map(o => ({ id: o.id, solids: o.closure!.pieces, color: new THREE.Color(0x7be4ce) })), 1));
    if (mode === 'Openings') {
        const positions: number[] = [], colors: number[] = [];
        for (const o of p.openings) {
            const color = new THREE.Color((state.openingStates[o.id] ?? o.defaultState) === 'OPEN' ? 0x78e1f2 : 0xf3bc64);
            for (const poly of o.aperturePolygons)
                for (let i = 0; i < poly.length; i++) {
                    for (const p of [poly[i], poly[(i + 1) % poly.length]]) {
                        positions.push(p.x, p.y, p.z);
                        colors.push(color.r, color.g, color.b);
                    }
                }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false })));
    }
    if (mode === 'Compartment Connectivity' || mode === 'Isolation') {
        const positions: number[] = [], lineColors: number[] = [], nodes = new Map(p.compartments.map(c => [c.id, c.centroid]));
        for (const o of p.openings) {
            if (!nodes.has(o.toCompartmentId))
                continue;
            const pts = [nodes.get(o.fromCompartmentId)!, o.aperturePolygons[0][0], nodes.get(o.toCompartmentId)!];
            for (let i = 1; i < pts.length; i++) {
                positions.push(pts[i - 1].x, pts[i - 1].y, pts[i - 1].z, pts[i].x, pts[i].y, pts[i].z);
                const c = new THREE.Color((state.openingStates[o.id] ?? o.defaultState) === 'OPEN' ? 0x8df1ee : 0xffb965);
                lineColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
        root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false })));
        const markers = new THREE.InstancedMesh(new THREE.SphereGeometry(Math.max(.2, b.order.length * .0025), 6, 4), new THREE.MeshBasicMaterial({ color: 0xc8ffff, depthTest: false }), p.compartments.length), matrix = new THREE.Matrix4();
        p.compartments.forEach((c, i) => markers.setMatrixAt(i, matrix.makeTranslation(c.centroid.x, c.centroid.y, c.centroid.z)));
        root.add(markers);
    }
    const ghost=mesh(b.physicalDesign!.surfaces.filter(s=>s.kind==='HULL').map(s=>({id:s.id,solids:s.pieces.map(p=>p.solid),color:new THREE.Color(0x577b91)})),Math.min(.15,hullOpacity*.25));ghost.raycast=()=>{};root.add(ghost);
    // Sparse authoritative Hull outline; no opaque exterior or invented room boxes.
    const positions: number[] = [];
    const hosts=new Set(p.compartments.map(c=>c.parentStructuralVolumeRef));
    for(const v of b.structuralVolumes.filter(v=>hosts.has(v.id))){const rings=v.geometry.stations.map(s=>profileRing(s).map(([x,y])=>({x:x+v.position.x,y:y+v.position.y,z:s.z+v.position.z})));for(const i of [...new Set([0,Math.floor(rings.length/2),rings.length-1])])for(let j=0;j<rings[i].length;j++){const a=rings[i][j],b=rings[i][(j+1)%rings[i].length];positions.push(a.x,a.y,a.z,b.x,b.y,b.z);}for(let i=1;i<rings.length;i++)for(const j of [...new Set([0,Math.floor(rings[i].length/4),Math.floor(rings[i].length/2),Math.floor(rings[i].length*3/4)])]){const a=rings[i-1][j],b=rings[i][j];positions.push(a.x,a.y,a.z,b.x,b.y,b.z);}}
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x50677b, transparent: true, opacity: .16, depthWrite: false })));
    return root;
}
