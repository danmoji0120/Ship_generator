import assert from'node:assert/strict';
/** Node/Chromium libm may differ by a few ULP in existing prefab trig. Do not
 * round design data. Compare finite values at the existing geometry tolerance;
 * only the compartment source digest is expected to differ with its raw input. */
export function compareRuntimeBlueprints(a,b){let numericDifferences=0,maxAbsoluteError=0,solidComparisons=0,maxVertexDeviationM=0;const hashes=[];
 function walk(a,b,path=''){
  if(a===b)return;
  if(a&&b&&typeof a==='object'&&!Array.isArray(a)&&Array.isArray(a.vertices)&&Array.isArray(a.indices)&&Array.isArray(b.vertices)&&Array.isArray(b.indices)){
   assert.equal(a.vertices.length,b.vertices.length,path+' finite vertex count');assert.equal(a.indices.length,b.indices.length,path+' finite triangle count');
   // Canonical convex hull triangulation can choose a different face fan for ULP ties.
   // Compare the actual closed convex point set and signed material volume, not fan order.
   for(const [left,right]of[[a,b],[b,a]])for(const p of left.vertices){const d=Math.min(...right.vertices.map(q=>Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)));assert(d<=1e-7,path+' finite point-set deviation '+d);maxVertexDeviationM=Math.max(maxVertexDeviationM,d);}
   const volume=s=>{const o=s.vertices.reduce((p,q)=>({x:p.x+q.x/s.vertices.length,y:p.y+q.y/s.vertices.length,z:p.z+q.z/s.vertices.length}),{x:0,y:0,z:0});let v=0;for(let i=0;i<s.indices.length;i+=3){const[a,b,c]=s.indices.slice(i,i+3).map(k=>({x:s.vertices[k].x-o.x,y:s.vertices[k].y-o.y,z:s.vertices[k].z-o.z}));v+=a.x*(b.y*c.z-b.z*c.y)+a.y*(b.z*c.x-b.x*c.z)+a.z*(b.x*c.y-b.y*c.x);}return Math.abs(v/6);};walk(volume(a),volume(b),path+'.signedVolumeM3');solidComparisons++;return;
  }
  if(path==='.compartmentPlan.sourceSignature'){assert.match(a,/^INTERIOR_1\//);assert.match(b,/^INTERIOR_1\//);hashes.push({path,node:a,browser:b});return;}
  if(typeof a==='number'&&typeof b==='number'){assert(Number.isFinite(a)&&Number.isFinite(b));const error=Math.abs(a-b),tolerance=1e-7+Math.max(Math.abs(a),Math.abs(b))*1e-12;assert(error<=tolerance,`${path}: ${a} vs ${b}`);numericDifferences++;maxAbsoluteError=Math.max(maxAbsoluteError,error);return;}
  assert.equal(typeof a,typeof b,path);assert(a&&b&&typeof a==='object',path+' differs');assert.deepEqual(Object.keys(a),Object.keys(b),path+' ordered keys/array count');for(const k of Object.keys(a))walk(a[k],b[k],path+'.'+k);
 }walk(a,b);return{numericDifferences,maxAbsoluteError,solidComparisons,maxVertexDeviationM,tolerance:'1e-7 absolute + 1e-12 relative, no rounding of saved data',hashes};
}
