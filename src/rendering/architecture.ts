import {connectorGeometryParts} from '../generation/architecture/connector-geometry';
import * as THREE from "three";
import type {
  ShipBlueprint,
  StructuralConnector,
  VolumeType,
} from "../blueprint/types";
import { loftGeometry, beamBetween } from "./geometry";
import type { DebugView } from "./ship";
import {
  shapeStations,
} from "../generation/shapes/definition";
import { shipMaterials } from "./materials";
const vector = (p: { x: number; y: number; z: number }) =>
  new THREE.Vector3(p.x, p.y, p.z);
export const VOLUME_COLORS: Record<VolumeType, number> = {
  PRIMARY_HULL: 0x80bdd8,
  HULL_BLOCK: 0xa0b8df,
  POD: 0xe5ae69,
  NACELLE: 0x95dcc5,
  SPINE: 0xe7cf88,
  ARMOR_BLOCK: 0xad9cda,
  DORSAL_STRUCTURE: 0xc9b4e0,
  VENTRAL_STRUCTURE: 0x8493a5,
};
export function connectorGroup(
  c: StructuralConnector,
  material: THREE.Material,
  scale: number,
) {
  const root=new THREE.Group();root.userData.connectorId=c.id;root.userData.joinType=c.join?.type??c.type;
  if((!c.join||['TRUSS','BOOM'].includes(c.join.type))&&c.style==='armored collar'){
    const start=vector(c.start),end=vector(c.end),delta=end.clone().sub(start),mesh=new THREE.Mesh(new THREE.BoxGeometry(c.thickness,c.thickness,delta.length()+scale*.003),material);mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),delta.normalize());root.add(mesh);return root;
  }
  for(const p of connectorGeometryParts(c,scale)){
    if(p.kind==='BEAM')root.add(beamBetween(vector(p.start),vector(p.end),p.radius,material));
    else{const mesh=new THREE.Mesh(loftGeometry(shapeStations(p.shape)),material);mesh.position.copy(vector(p.position));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),vector(p.axis));root.add(mesh);}
  }
  return root;
}
export function renderArchitecture(
  b: ShipBlueprint,
  mode: DebugView,
  materials: ReturnType<typeof shipMaterials>,
  ghost: THREE.Material,
) {
  const root = new THREE.Group(),
    showStructure = ["Normal", "Structure", "Architecture"].includes(mode);
  for (const [index, v] of b.structuralVolumes.entries()) {
    const g = new THREE.Group();
    g.position.copy(vector(v.position));
    g.rotation.set(v.rotation.x, v.rotation.y, v.rotation.z);
    g.userData.structureId = v.id;
    const material =
      mode === "Architecture"
        ? new THREE.MeshStandardMaterial({
            color: VOLUME_COLORS[v.type],
            roughness: 0.68,
          })
        : showStructure
          ? v.type === "NACELLE" || v.type === "POD"
            ? materials.secondary
            : materials.hull
          : ghost;
    if (mode === "Hull Sections")
      for (
        let i = 0;
        i < (v.shape ? shapeStations(v.shape) : v.geometry.stations).length - 1;
        i++
      ) {
        const mesh = new THREE.Mesh(
          loftGeometry(
            (v.shape ? shapeStations(v.shape) : v.geometry.stations).slice(
              i,
              i + 2,
            ),
          ),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(
              0.45 + (index * 2 + i) * 0.045,
              0.44,
              0.52,
            ),
            roughness: 0.7,
          }),
        );
        g.add(mesh);
        g.add(
          new THREE.LineSegments(
            new THREE.EdgesGeometry(mesh.geometry, 16),
            new THREE.LineBasicMaterial({ color: 0x17303b }),
          ),
        );
      }
    else {
      const mesh = new THREE.Mesh(
        loftGeometry(v.shape ? shapeStations(v.shape) : v.geometry.stations),
        material,
      );
      g.add(mesh);
      if (showStructure)
        g.add(
          new THREE.LineSegments(
            new THREE.EdgesGeometry(mesh.geometry, 24),
            new THREE.LineBasicMaterial({
              color: mode === "Architecture" ? 0x29394d : 0x334c5b,
              transparent: true,
              opacity: 0.38,
            }),
          ),
        );
    }
    root.add(g);
    if (mode === "Structural Graph") {
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(b.order.length * 0.01, 8, 6),
        new THREE.MeshBasicMaterial({ color: VOLUME_COLORS[v.type] }),
      );
      node.position.copy(vector(v.position));
      root.add(node);
    }
  }
  for (const c of b.structuralConnectors) {
    const graph = mode === "Structural Graph";
    const color =
      c.type === "TRUSS" ? 0xe8b477 : c.type === "DIRECT" ? 0xb9cad5 : 0x8cdec8;
    const material =
      graph || mode === "Architecture"
        ? new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
        : showStructure
          ? c.style === "armored collar"
            ? materials.hull
            : materials.secondary
          : ghost;
    root.add(connectorGroup(c, material, b.order.length));
    if (graph) {
      const a = b.structuralVolumes.find((v) => v.id === c.fromStructureId)!,
        d = b.structuralVolumes.find((v) => v.id === c.toStructureId)!;
      root.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            vector(a.position),
            vector(c.start),
            vector(c.end),
            vector(d.position),
          ]),
          new THREE.LineBasicMaterial({ color }),
        ),
      );
    }
  }
  return root;
}
