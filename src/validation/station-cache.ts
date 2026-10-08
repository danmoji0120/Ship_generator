/** Persisted stations are authoritative for rendering. Check their parameter cache without
 * rejecting one-ULP arithmetic differences between browser V8 and Node V8 builds.
 * Counts, keys and nonnumeric fields remain exact; this does not rewrite stored geometry. */
export function stationCacheEqual(expected:unknown,stored:unknown):boolean {
  if(typeof expected==='number'&&typeof stored==='number')return Number.isFinite(expected)&&Number.isFinite(stored)&&Math.abs(expected-stored)<=32*Number.EPSILON*Math.max(1,Math.abs(expected),Math.abs(stored));
  if(Array.isArray(expected))return Array.isArray(stored)&&expected.length===stored.length&&expected.every((v,i)=>stationCacheEqual(v,stored[i]));
  if(expected&&stored&&typeof expected==='object'&&typeof stored==='object'){
    const a=expected as Record<string,unknown>,b=stored as Record<string,unknown>;
    return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&stationCacheEqual(a[k],b[k]));
  }
  return expected===stored;
}
