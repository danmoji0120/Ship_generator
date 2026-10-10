import * as THREE from "three";
import type { ShipBlueprint } from "../blueprint/types";
import { MOUNT_TYPES } from "../generation/hardpoint-system/types";
const colors = { S: 0x79dfff, M: 0x96f0b0, L: 0xffc36d, XL: 0xe397ff };
/** Empty slots have no Production mesh. Debug markers batch by mounting type (<=7 calls). */
export function renderModularHardpoints(b: ShipBlueprint) {
  const root = new THREE.Group();
  root.userData.modularMarkers = true;
  const lines: number[] = [],
    matrix = new THREE.Matrix4(),
    rotation = new THREE.Quaternion();
  for (const type of MOUNT_TYPES) {
    const hs = b.hardpoints.filter((h) => h.modular?.mountTypes[0] === type);
    if (!hs.length) continue;
    const geometry =
      type === "TURRET"
        ? new THREE.SphereGeometry(1, 8, 5)
        : type === "MISSILE"
          ? new THREE.OctahedronGeometry(1)
          : type === "UTILITY"
            ? new THREE.BoxGeometry(1.4, 1.4, 1.4)
            : type === "SPINAL" || type === "FIXED"
              ? new THREE.ConeGeometry(0.8, 2, 6)
              : new THREE.IcosahedronGeometry(1);
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshBasicMaterial({
        depthTest: false,
        transparent: true,
        opacity: 0.92,
      }),
      hs.length,
    );
    mesh.renderOrder = 20;
    mesh.userData.modularSlotIds = hs.map((h) => h.id);
    hs.forEach((h, i) => {
      const scale =
          b.order.length * 0.0036 * { S: 1, M: 1.25, L: 1.55, XL: 1.9 }[h.size],
        p = new THREE.Vector3(h.position.x, h.position.y, h.position.z),
        n = new THREE.Vector3(h.normal.x, h.normal.y, h.normal.z);
      rotation.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      matrix.compose(p, rotation, new THREE.Vector3(scale, scale, scale));
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, new THREE.Color(colors[h.size]));
      const end = p.clone().addScaledVector(n, scale * 4);
      lines.push(p.x, p.y, p.z, end.x, end.y, end.z);
    });
    mesh.computeBoundingSphere();
    root.add(mesh);
  }
  // Exact measured footprint boundary, not the nominal marker radius. Historical
  // plans retain their original debug rendering; Normal never calls this helper.
  if(b.modularHardpoints?.version === "1.8.5.4.1")for(const size of ["S","M","L","XL"] as const){
    const boundary:number[]=[];
    for(const h of b.hardpoints.filter(h=>h.size===size&&h.modular?.state==="EMPTY")){
      const m=h.modular!,points=m.contacts.slice(0,m.region==="FORE"||m.region==="AFT"?4:8);
      for(let i=0;i<points.length;i++){const a=points[i].position,c=points[(i+1)%points.length].position;boundary.push(a.x,a.y,a.z,c.x,c.y,c.z);}
    }
    if(boundary.length){const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(boundary,3));const l=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:colors[size],depthTest:false,transparent:true,opacity:.55}));l.renderOrder=18;root.add(l);}
  }
  const pairLines:number[]=[];
  const pairs=new Map<string,typeof b.hardpoints>();
  for(const h of b.hardpoints){const id=h.modular?.pairId;if(id)pairs.set(id,[...(pairs.get(id)??[]),h]);}
  for(const hs of pairs.values())if(hs.length===2){for(const h of hs)pairLines.push(h.position.x,h.position.y,h.position.z);}
  if(pairLines.length){const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(pairLines,3));const l=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xd7b98c,depthTest:false,transparent:true,opacity:.35}));l.renderOrder=18;root.add(l);}
  const groups = new Map<string, typeof b.hardpoints>();
  for(const h of b.hardpoints){const id=h.modular?.batteryGroupId;if(id)groups.set(id,[...(groups.get(id)??[]),h]);}
  for(const hs of groups.values()){
    for(const side of [-1,1]){const row=hs.filter(h=>side<0?h.position.x<-.01:h.position.x>=-.01).sort((a,c)=>a.position.z-c.position.z);
      for(let i=1;i<row.length;i++){const a=row[i-1].position,c=row[i].position;lines.push(a.x,a.y,a.z,c.x,c.y,c.z);}
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
  const arrows = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0xb0cfe0,
      depthTest: false,
      transparent: true,
      opacity: 0.6,
    }),
  );
  arrows.renderOrder = 19;
  root.add(arrows);
  return root;
}
