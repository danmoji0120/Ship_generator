import type { Vec3 } from '../../blueprint/types';
import { mix } from '../integration/contours';
/** Ring-plane point test; vertices are clockwise. Unlike AABB fitting this respects slopes and chamfers. */
export function inArmor(rings: Vec3[][], p: Vec3, tolerance = 0) {
  if (p.z < rings[0][0].z - tolerance || p.z > rings.at(-1)![0].z + tolerance) return false;
  let j = rings.findIndex(r => r[0].z >= p.z) - 1;
  j = Math.max(0, Math.min(rings.length - 2, j));
  const t = Math.max(0, Math.min(1, (p.z - rings[j][0].z) / (rings[j + 1][0].z - rings[j][0].z)));
  const ring = rings[j].map((q, i) => mix(q, rings[j + 1][i], t));
  return ring.every((a, i) => {
    const d = ring[(i + 1) % ring.length];
    return (d.x - a.x) * (p.y - a.y) - (d.y - a.y) * (p.x - a.x) <= tolerance * Math.hypot(d.x - a.x, d.y - a.y);
  });
}
export function armorSamples(rings: Vec3[][]) {
  const points: Vec3[] = [];
  for (let j = 0; j < rings.length - 1; j++) {
    for (let z = 0; z <= 2; z++) {
      const r = rings[j].map((p, i) => mix(p, rings[j + 1][i], z / 2));
      for (let i = 0; i < r.length; i++)
        for (let k = 0; k <= 2; k++) points.push(mix(r[i], r[(i + 1) % r.length], k / 2));
      // Interior cross-section samples catch a clearance cylinder contained inside a wide plate.
      for (let k = 0; k <= 3; k++) points.push(mix(mix(r[0], r[5], k / 3), mix(r[2], r[3], k / 3), .5));
    }
  }
  return points;
}
/** Indexed closed loft; every cap triangle uses a convex ring vertex fan. Shared by geometry audits. */
export function armorTriangles(rings: Vec3[][]): [Vec3, Vec3, Vec3][] {
  const faces: [Vec3, Vec3, Vec3][] = [], n = rings[0].length;
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < n; i++) {
    const a = rings[j][i], b = rings[j][(i + 1) % n], c = rings[j + 1][i], d = rings[j + 1][(i + 1) % n];
    faces.push([a, c, b], [b, c, d]);
  }
  for (let i = 1; i < n - 1; i++) faces.push([rings[0][0], rings[0][i], rings[0][i + 1]], [rings.at(-1)![0], rings.at(-1)![i + 1], rings.at(-1)![i]]);
  return faces;
}

/** Conservative cylinder bounds used only for broad-phase rejection; fitting remains station based. */
export function reservationBounds(z: import('../../blueprint/types').EquipmentZone): import('../../blueprint/types').BoundsData {
  const min={x:0,y:0,z:0},max={x:0,y:0,z:0};
  for(const k of ['x','y','z'] as const) {
    const a=z.position[k]+z.normal[k]*z.rootClearance,d=z.position[k]+z.normal[k]*z.depth;
    const radius=z.radius*Math.sqrt(Math.max(0,1-z.normal[k]**2));
    min[k]=Math.min(a,d)-radius;max[k]=Math.max(a,d)+radius;
  }
  return {min,max};
}
export function overlappingBounds(a: import('../../blueprint/types').BoundsData,b: import('../../blueprint/types').BoundsData) {
  return (['x','y','z'] as const).every(k=>a.max[k]>b.min[k]&&b.max[k]>a.min[k]);
}

/** Reciprocal probes catch a narrow equipment corridor wholly contained by a broad armor prism. */
export function reservationSamples(z: import('../../blueprint/types').EquipmentZone) {
  const reference=Math.abs(z.normal.y)>.9?{x:0,y:0,z:1}:{x:0,y:1,z:0};
  const cross=(a:Vec3,b:Vec3):Vec3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  const raw=cross(z.normal,reference),len=Math.hypot(raw.x,raw.y,raw.z),u={x:raw.x/len,y:raw.y/len,z:raw.z/len},v=cross(z.normal,u);
  const points:Vec3[]=[];
  for(const t of [.005,.05,.20,.5,.8,.995]) {
    const axial=z.rootClearance+(z.depth-z.rootClearance)*t;
    const center={x:z.position.x+z.normal.x*axial,y:z.position.y+z.normal.y*axial,z:z.position.z+z.normal.z*axial};
    points.push(center);
    for(let i=0;i<8;i++) {const angle=i*Math.PI/4,r=z.radius*.92;points.push({x:center.x+(u.x*Math.cos(angle)+v.x*Math.sin(angle))*r,y:center.y+(u.y*Math.cos(angle)+v.y*Math.sin(angle))*r,z:center.z+(u.z*Math.cos(angle)+v.z*Math.sin(angle))*r});}
  }
  return points;
}
