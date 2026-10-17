import * as THREE from 'three';
import type { ShipBlueprint } from '../blueprint/types';
import type { SystemInstanceState } from '../systems/types';
import { evaluateShipCapabilities, analyzeSystemRedundancy } from '../systems/evaluate';
import { profileRing } from '../generation/hull';
export const SYSTEM_VIEWS = ['Internal Systems', 'Power Network', 'Control Network', 'System Redundancy', 'Equipment Mass'] as const;
const colors: Record<string, number> = { POWER_GENERATOR: 0xffb65c, POWER_DISTRIBUTION: 0x71d8ed, ENERGY_STORAGE: 0xc19aff, COMMAND_CONTROL: 0x85f0ba, PROPULSION_CONTROL: 0x74a6ff, MANEUVER_CONTROL: 0xd8ee78, FIRE_CONTROL: 0xff8b9c, SENSOR_PROCESSING: 0xa1f0ed };
export function renderSystems(b: ShipBlueprint, mode: string, state?: SystemInstanceState, selected?: string) {
    const root = new THREE.Group(), plan = b.functionalSystems!, cap = evaluateShipCapabilities(b, state), fractions = new Map(cap.equipment.map(e => [e.id, e.functionalFraction])), critical = mode === 'System Redundancy' ? new Set(analyzeSystemRedundancy(plan).filter(e => e.singlePointOfTotalFailure.length).map(e => e.equipmentId)) : new Set();
    for (const e of plan.equipment) {
        const color = e.id === selected ? 0xffffff : (fractions.get(e.id) ?? 0) === 0 ? 0xff4545 : critical.has(e.id) ? 0xff764b : mode === 'Equipment Mass' ? new THREE.Color().setHSL(.6 - .6 * Math.log1p(e.massKg) / Math.log1p(20000), .8, .6) : colors[e.type], mesh = new THREE.Mesh(new THREE.BoxGeometry(e.sizeM.x, e.sizeM.y, e.sizeM.z), new THREE.MeshBasicMaterial({ color, depthTest: false }));
        mesh.position.set(e.position.x, e.position.y, e.position.z);
        mesh.userData.systemId = e.id;
        root.add(mesh);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0xefffff, transparent: true, opacity: .6, depthTest: false }));
        edges.position.copy(mesh.position);
        root.add(edges);
    }
    const network = mode === 'Control Network' ? plan.controlNetwork : mode === 'Power Network' || mode === 'System Redundancy' ? plan.powerNetwork : [], points: number[] = [], lineColors: number[] = [];
    for (const e of network) {
        const a = plan.equipment.find(n => n.id === e.from)!, c = plan.equipment.find(n => n.id === e.to)!;
        const disabled = (mode === 'Control Network' ? state?.disabledControlEdges : state?.disabledPowerEdges)?.includes(e.id);
        const color = new THREE.Color(disabled ? 0xff4646 : mode === 'Control Network' ? 0x8af4b8 : (cap.edgeFlowsMW[e.id] ?? 0) > 0 ? 0xffcb77 : 0x486877);
        for (const p of [a.position, c.position]) {
            points.push(p.x, p.y, p.z);
            lineColors.push(color.r, color.g, color.b);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
    root.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false })));
    // Sparse authoritative Hull contours: no second full CSG interior mesh or opaque exterior.
    const outline: number[] = [];
    for (const v of b.structuralVolumes) {
        const stations = v.geometry.stations;
        for (const i of [0, Math.floor(stations.length / 2), stations.length - 1]) {
            const ring = profileRing(stations[i]);
            for (let j = 0; j < ring.length; j++)
                for (const p of [ring[j], ring[(j + 1) % ring.length]])
                    outline.push(p[0] + v.position.x, p[1] + v.position.y, stations[i].z + v.position.z);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(outline, 3));
    root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x527686, transparent: true, opacity: .28, depthWrite: false })));
    return root;
}
