import type {ConvexCell} from '../physical/types';
import type {InteriorCompartment} from './types';
import {storedSolid,cellCentroid} from './geometry';
import {solidCell} from '../physical/convex';
import {add,mul,boundsOf} from '../generation/integration/contours';
import type {Vec3} from '../blueprint/types';
import {cellVolume,planes,cellBounds} from '../physical/convex';
import {center} from '../generation/integration/contours';
/** Deterministic, conservative placement witness. A large total volume is not a fit.
 * True means a complete .5m cube fits in one actual convex cell. False is a policy
 * classification, not a proof that no possible rotated equipment could ever fit. */
export function clearanceWitness(cells:ConvexCell[], sideM=.5):Vec3|undefined{
 for(const c of [...cells].sort((a,b)=>cellVolume(b)-cellVolume(a))){const p=center(c.faces.flat()),h=sideM/2;
  if(planes(c).every(q=>q.d-q.n.x*p.x-q.n.y*p.y-q.n.z*p.z >= h*(Math.abs(q.n.x)+Math.abs(q.n.y)+Math.abs(q.n.z))+1e-7))return p;
 }
}
export function classifyVoidComponents(groups:{cells:ConvexCell[];volumeM3:number}[],axis:'y'|'z',range:[number,number]){
 return groups.map((g,i)=>{const witness=clearanceWitness(g.cells),b=cellBounds({faces:g.cells.flatMap(c=>c.faces)}),cutContact=b.min[axis]<=range[0]+1e-5||b.max[axis]>=range[1]-1e-5;
  return {...g,witness,classification:i===0?'MAIN' as const:!witness?'NONALLOCATABLE' as const:cutContact?'USABLE_RESIDUAL' as const:'RECOVERABLE' as const,reason:i===0?'Primary connected chamber':!witness?'No .5m axis-aligned cube witness in a finite cell; conservative current placement policy':cutContact?'Usable finite witness, but partition interface needs separate boundary ownership; not promoted':'Independent finite component with clearance witness, away from partition interfaces'};
 });
}

/** Actual closed, disconnected void becomes its own node; no wall or portal is invented. */
export function recoverVoidCompartment(base:InteriorCompartment,cells:ConvexCell[],id:string):InteriorCompartment{
 const solids=cells.map(storedSolid),actual=solids.map(solidCell),v=actual.reduce((n,c)=>n+cellVolume(c),0);
 return {...base,id,recoveryOf:base.id,physicalVolume:{model:'FINITE_CONNECTED_CSG_COMPONENT',domains:solids,connectedCells:solids,occupiedRefs:[]},volumeM3:v,domainVolumeM3:v,occupiedVolumeM3:0,centroid:mul(actual.reduce((m,c)=>add(m,mul(cellCentroid(c),cellVolume(c))),{x:0,y:0,z:0}),1/v),localBounds:boundsOf(solids.flatMap(s=>s.vertices)),extractionAudit:{candidateDomainVolumeM3:v,excludedSolidVolumeM3:0,unresolvedVoidVolumeM3:0,significantOtherComponents:0},boundaryReferences:[],adjacentCompartmentIds:[],openingReferences:[],exteriorPatches:[],unresolvedBoundaryReasons:[],pressureCapability:'PRESSURIZABLE',boundaryCertainty:'FINITE_MATERIAL_CLOSURE',futureSystemPlacement:{...base.futureSystemPlacement,bulkheadRefs:[]}};
}
