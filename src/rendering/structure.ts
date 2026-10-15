import * as THREE from 'three';
import type { ShipBlueprint } from '../blueprint/types';
import type { FrameMember } from '../structure/types';
import { shapeStations } from '../generation/shapes/definition';
import { profileRing } from '../generation/hull';
export const STRUCTURAL_VIEWS = ['Frame', 'Connectivity', 'Critical Connections', 'Structural Mass'] as const;
const palette: Record<FrameMember['type'], number> = { PRIMARY_LONGITUDINAL: 0xc7edff, TRANSVERSE_FRAME: 0x4bbdcc, REINFORCEMENT: 0xfeb75f, TRUSS_MEMBER: 0xe8bb73, STRUCTURAL_CONNECTOR: 0xe2bf8e, STRUCTURAL_SUPPORT: 0x93ddb2 };
function memberMesh(members: FrameMember[], color: (m: FrameMember) => THREE.Color, opacity = 1) {
    const positions: number[] = [], colors: number[] = [], ranges: {
        start: number;
        end: number;
        id: string;
    }[] = [];
    for (const m of members) {
        const c = color(m), start = positions.length / 9;
        for (const p of m.pieces)
            for (const i of p.indices) {
                const v = p.vertices[i];
                positions.push(v.x, v.y, v.z);
                colors.push(c.r, c.g, c.b);
            }
        ranges.push({ start, end: positions.length / 9, id: m.id });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .64, side: THREE.DoubleSide, transparent: opacity < 1, opacity, depthWrite: opacity === 1 }));
    mesh.userData.structuralRanges = ranges;
    return mesh;
}
/** Optional merged debug meshes only. Normal never calls this module's builders. */
export function renderStructuralFrame(b: ShipBlueprint, mode: string) {
    const root = new THREE.Group();
    root.userData.structuralDebug = true;
    const f = b.structuralFrame;
    if (!f)
        return root;
    const critical = new Set(f.analysis.bridges), articulation = new Set(f.analysis.articulationPoints), roots = new Set(f.roots), max = Math.max(...f.members.map(m => m.massKg)), graph = mode === 'Connectivity' || mode === 'Critical Connections';
    root.add(memberMesh(f.members, m => mode === 'Structural Mass' ? new THREE.Color().setHSL(.58 - .58 * Math.log1p(m.massKg) / Math.log1p(max), .7, .57) : new THREE.Color(palette[m.type]), graph ? .23 : 1));
    // Sparse true station boundary context rather than an opaque outer shell.
    const guide: number[] = [];
    for (const v of b.structuralVolumes) {
        const stations = v.shape ? shapeStations(v.shape) : v.geometry.stations, rings = stations.map(s => profileRing(s).map(([x, y]) => new THREE.Vector3(x + v.position.x, y + v.position.y, s.z + v.position.z)));
        for (const i of [...new Set([0, Math.floor(rings.length / 2), rings.length - 1])])
            for (let j = 0; j < rings[i].length; j++)
                guide.push(...rings[i][j].toArray(), ...rings[i][(j + 1) % rings[i].length].toArray());
        for (let i = 1; i < rings.length; i++)
            for (const j of [0, 2, 4, 6])
                guide.push(...rings[i - 1][j].toArray(), ...rings[i][j].toArray());
    }
    const hull = new THREE.BufferGeometry();
    hull.setAttribute('position', new THREE.Float32BufferAttribute(guide, 3));
    root.add(new THREE.LineSegments(hull, new THREE.LineBasicMaterial({ color: 0x54758c, transparent: true, opacity: .27, depthWrite: false })));
    if (graph) {
        const positions: number[] = [], colors: number[] = [], nodes = new Map(f.nodes.map(n => [n.id, n]));
        for (const e of f.edges) {
            const color = new THREE.Color(mode === 'Critical Connections' && critical.has(e.id) ? 0xff6958 : 0x6cdbe6);
            for (const id of e.nodeIds) {
                const p = nodes.get(id)!.position;
                positions.push(p.x, p.y, p.z);
                colors.push(color.r, color.g, color.b);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false })));
        const markers = new THREE.InstancedMesh(new THREE.SphereGeometry(Math.max(.18, b.order.length * .002), 6, 4), new THREE.MeshBasicMaterial({ depthTest: false }), f.nodes.length), matrix = new THREE.Matrix4();
        for (let i = 0; i < f.nodes.length; i++) {
            const n = f.nodes[i];
            markers.setMatrixAt(i, matrix.makeTranslation(n.position.x, n.position.y, n.position.z));
            markers.setColorAt(i, new THREE.Color(roots.has(n.id) ? 0x8affc1 : mode === 'Critical Connections' && articulation.has(n.id) ? 0xffb34d : 0x6b9bab));
        }
        root.add(markers);
    }
    return root;
}
export function structuralHighlight(b: ShipBlueprint, id: string) {
    const member = b.structuralFrame?.members.find(m => m.id === id);
    const g = new THREE.Group();
    if (member) {
        const mesh = memberMesh([member], () => new THREE.Color(0xffffff), .85);
        (mesh.material as THREE.Material).depthTest = false;
        g.add(mesh);
    }
    return g;
}
