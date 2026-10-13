import {PREVIEW_EQUIPMENT,type PreviewEquipment} from '../equipment-preview/library';
/** Non-combat structural fixture; deliberately has no launch tubes, shots or propulsion simulation. */
const pod:PreviewEquipment={...PREVIEW_EQUIPMENT.find(e=>e.id==='missile-small')!,id:'test-pod',name:'Utility test pod · VISUAL ONLY',mountType:'UTILITY',tubes:0,componentCount:1,footprint:{width:4,length:7},body:{width:4,height:4,length:10,z:0},envelope:{width:4,height:6,length:10},yaw:[0],elevation:[90]};
export const FREE_EQUIPMENT=[...PREVIEW_EQUIPMENT,pod];

const variants=new Map<string,PreviewEquipment>();
export function freeDefinition(id:string,tilt=0){const base=FREE_EQUIPMENT.find(e=>e.id===id);if(!base)throw Error('Unknown equipment');if(!Number.isFinite(tilt)||Math.abs(tilt)>30)throw Error('Launcher tilt must be -30…30 degrees');if(!tilt||base.kind!=='MISSILE'||id==='test-pod')return base;const key=id+'/'+tilt;let e=variants.get(key);if(!e){e={...base,launchTiltDegrees:tilt};if(variants.size>=128)variants.delete(variants.keys().next().value!);variants.set(key,e);}return e;}
