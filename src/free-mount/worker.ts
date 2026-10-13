import type {ShipBlueprint} from '../blueprint/types';
import type {FreeMountRequest} from './types';
import {evaluateFreeMount} from './planner';
let blueprint:ShipBlueprint|undefined;
self.onmessage=e=>{try{blueprint=e.data.blueprint??blueprint;if(!blueprint)throw Error('No ship');self.postMessage({id:e.data.id,result:evaluateFreeMount(blueprint,e.data.request,e.data.quick)});}catch(error){self.postMessage({id:e.data.id,error:String(error)});}};
