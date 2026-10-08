import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
/** Support both a fresh QA run and the compact checked-in artifact archive. */
export async function readBlueprint(path){
 try{return JSON.parse(await readFile(path,'utf8'));}
 catch(error){if(error.code!=='ENOENT')throw error;return JSON.parse(gunzipSync(await readFile(path+'.gz')).toString());}
}
