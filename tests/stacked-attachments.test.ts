import {it,expect} from 'vitest';
import {generateBlueprint,DEFAULT_ORDER} from '../src/generation/generate';
import {validateBlueprint} from '../src/validation/validate';

it('validates STACKED_BLOCKS production armor, engine joins and weapon foundations in a directly affected representative',()=>{
 const blueprint=generateBlueprint({...structuredClone(DEFAULT_ORDER),shipyardId:'forge',length:300,role:'Cruiser',massClass:'Standard'},7,{architecture:'STACKED_BLOCKS',family:'WEDGE_CITADEL'});
 expect(validateBlueprint(blueprint)).toEqual([]);
 expect(blueprint.engines.length).toBeGreaterThan(0);
 expect(blueprint.hardpoints.length).toBeGreaterThan(0);
 expect(blueprint.productionDesign?.validation.issues).toEqual([]);
});
