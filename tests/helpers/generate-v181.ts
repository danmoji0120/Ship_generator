// Historical regression fixtures keep their original generation contract explicitly.
import{generateBlueprint as current}from'../../src/generation/generate';
export * from '../../src/generation/generate';
export const generateBlueprint:typeof current=(order,seed,options)=>current(order,seed,{version:'1.8.1',...options});
