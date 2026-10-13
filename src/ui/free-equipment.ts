import type {AnyShipBlueprint,ShipBlueprint,Vec3} from '../blueprint/types';
import type {ShipViewer} from '../rendering/viewer';
import {FREE_EQUIPMENT} from '../free-mount/library';
import {EquipmentHistory} from '../free-mount/store';
import {nearbyAnchor} from '../free-mount/planner';
import {detailFrame} from '../generation/details/geometry';
import {sub,mul,add,dot,unit} from '../generation/integration/contours';
import type {FreeMountRequest,FreeMountResult,SurfaceAnchor} from '../free-mount/types';
export function setupFreeEquipment(viewer:ShipViewer|undefined,get:()=>AnyShipBlueprint,apply:(b:ShipBlueprint)=>void){
 const panel=document.createElement('section');panel.id='free-equipment-editor';panel.className='free-editor';
 panel.innerHTML=`<h3>Equipment Editor · External fitment</h3><p>신규 장비만 편집 · 내부 공간 / 급탄 / 하중 계산 없음. 좌클릭 설치 · 우클릭 드래그 카메라 · 휠 줌 · Alt+클릭 장비 선택.</p><label><input id="free-on" type="checkbox"> Equipment Editor ON</label><div class="free-tools"><label>Equipment<select id="free-equipment"></select></label><label>Mode<select id="free-mode"><option>SINGLE</option><option>MIRROR</option><option>BATTERY</option></select></label><label><input id="free-platform" type="checkbox" checked> Adaptive platform</label><label><input id="free-snap" type="checkbox"> 1m surface snap</label><label>Heading °<input id="free-heading" type="number" value="0" step="15"></label><label>Launcher tilt °<input id="free-launch-tilt" type="number" min="-30" max="30" value="0" step="5"></label><label>Count<input id="free-count" type="number" min="1" max="8" value="4"></label><label>Spacing m<input id="free-spacing" type="number" min="1" value="30"></label><label><input id="free-mirror-battery" type="checkbox" checked> Mirror battery</label></div><p>Battery: 시작점을 누르고 표면을 따라 드래그 → 놓기. 원점 고정 후 Confirm으로도 확정할 수 있습니다.</p><button id="free-confirm">Confirm installation</button><button id="free-cancel">Cancel ghost</button><label>Installed equipment<select id="free-selection"><option value="">None</option></select></label><label><input id="free-group" type="checkbox" checked> Edit whole pair / battery</label><button id="free-move">Move selected</button><button id="free-rotate">Rotate selected</button><button id="free-clone">Clone selected</button><button id="free-mirror-clone">Mirror selected</button><button id="free-delete">Delete selected</button><button id="free-clear">Remove all player equipment</button><button id="free-undo">Undo</button><button id="free-redo">Redo</button><button id="free-save">Save Blueprint</button><button id="free-load">Load Blueprint</button><pre id="free-status" role="status">Editor OFF</pre>`;
 document.getElementById('hardpoint-inspector')!.before(panel);
 const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
 const list=el<HTMLSelectElement>('free-equipment');for(const e of FREE_EQUIPMENT)list.add(new Option(`${e.name} · ${e.size} · ${e.footprint.width} × ${e.footprint.length}m`,e.id));list.value='gun-210';
 let history:EquipmentHistory|undefined,anchor:SurfaceAnchor|undefined,start:SurfaceAnchor|undefined,direction:Vec3|undefined,replacing:string[]=[],worker:Worker|undefined,lastBlueprint:ShipBlueprint|undefined,sequence=0,busy=false,installing=false,pending:undefined|{request:FreeMountRequest;quick:boolean;install:boolean},latestRequest:FreeMountRequest|undefined;
 const status=(s:string)=>el('free-status').textContent=s;
 const enabled=()=>el<HTMLInputElement>('free-on').checked;
 const changed=()=>{if(!history)return;apply(history.blueprint);populate();};
 const populate=()=>{const select=el<HTMLSelectElement>('free-selection'),old=select.value;select.replaceChildren(new Option('None',''),...(history?.blueprint.freeMountPlan?.entries??[]).map(e=>new Option(`${e.id} · ${e.equipmentId} · ${e.platform.kind}${e.batteryId?' · '+e.batteryId:''}`,e.id)));select.value=old;if(select.value)showSelection();};
 const selected=()=>history?.blueprint.freeMountPlan?.entries.find(e=>e.id===el<HTMLSelectElement>('free-selection').value);
 const selectedIds=()=>{const a=selected();if(!a)return[];return el<HTMLInputElement>('free-group').checked?(history!.blueprint.freeMountPlan?.entries??[]).filter(e=>a.batteryId?e.batteryId===a.batteryId:a.pairId?e.pairId===a.pairId:e.id===a.id).map(e=>e.id):[a.id];};
 const makeRequest=():FreeMountRequest|undefined=>{
  if(!anchor||!history)return;let point=start??anchor;
  if(el<HTMLInputElement>('free-snap').checked){const f=detailFrame(point.normal),origin=history.blueprint.structuralVolumes.find(v=>v.id===point.structureId)?.position??{x:0,y:0,z:0},q=sub(point.position,origin),x=dot(q,f.right),z=dot(q,f.forward);try{point=nearbyAnchor(history.blueprint,add(point.position,add(mul(f.right,Math.round(x)-x),mul(f.forward,Math.round(z)-z))),point.normal,1);}catch{status('INVALID · snapped surface is unavailable');return;}}
  return{equipmentId:list.value,anchor:point,headingDegrees:Number(el<HTMLInputElement>('free-heading').value),launchTiltDegrees:Number(el<HTMLInputElement>('free-launch-tilt').value),platforms:el<HTMLInputElement>('free-platform').checked,mode:el<HTMLSelectElement>('free-mode').value as FreeMountRequest['mode'],count:Number(el<HTMLInputElement>('free-count').value),spacing:Number(el<HTMLInputElement>('free-spacing').value),mirrorBattery:el<HTMLInputElement>('free-mirror-battery').checked,arrayDirection:direction,replaceIds:replacing,platformPreference:list.value==='test-pod'?'PYLON_BRACE':undefined};
 };
 const send=(request:FreeMountRequest,quick:boolean,install=false)=>{
  if(!history)return;latestRequest=request;
  if(busy){if(installing||pending?.install&&quick)return;pending={request,quick,install};sequence++;return;}
  const id=++sequence,b=history.blueprint;
  worker??=new Worker(new URL('../free-mount/worker.ts',import.meta.url),{type:'module'});
  worker.onmessage=event=>{
   busy=false;installing=false;
   if(event.data.id===sequence&&enabled()){
    const r=event.data.result as FreeMountResult|undefined;
    if(!r){status(event.data.error);viewer?.setFreeGhost();}
    else{viewer?.setFreeGhost(r);status(`${r.status} · ${r.elapsedMs.toFixed(1)}ms\n${r.reason}\n${r.entries.map(e=>`${e.equipmentId} / ${e.platform.kind} / ${e.id}`).join('\n')}${r.fits.some(f=>f.status==='PARTIAL_ARC')?'\nOperating arc restricted; only clear sampled directions are available.':''}`);
     if(install&&r.status!=='INVALID')try{history!.install(request,r);changed();anchor=undefined;start=undefined;replacing=[];latestRequest=undefined;viewer?.setFreeGhost();status(`Installed ${r.entries.length} equipment + owned supports · full external samples PASS`);}catch(e){status('INVALID · '+e);viewer?.setFreeGhost();}
    }
   }
   const next=pending;pending=undefined;if(next&&enabled())send(next.request,next.quick,next.install);
  };
  worker.onerror=()=>{busy=false;worker?.terminate();worker=undefined;lastBlueprint=undefined;status('Preview worker failed; retry');};
  busy=true;installing=install;worker.postMessage({id,request,quick,...(lastBlueprint!==b?{blueprint:b}:{})});lastBlueprint=b;
 };
 const refresh=(install=false)=>{const r=makeRequest();if(r)send(r,!install,install);};
 const cancel=()=>{sequence++;pending=undefined;anchor=undefined;start=undefined;direction=undefined;replacing=[];latestRequest=undefined;viewer?.setFreeGhost();status(enabled()?'Pick an exposed Hull / Armor surface':'Editor OFF');};
 const pick=(phase:'move'|'down'|'up',hit:SurfaceAnchor|undefined,event:PointerEvent)=>{
  if(!enabled()||!history||event.buttons>1)return;
  if(!hit){if(phase==='move'&&!start){sequence++;pending=undefined;anchor=undefined;viewer?.setFreeGhost();status('INVALID · No exposed Hull / Armor surface');}return;}
  anchor=hit;
  if(phase==='down'){start=el<HTMLSelectElement>('free-mode').value==='BATTERY'?hit:undefined;direction=undefined;}
  if(start){const delta=sub(hit.position,start.position),plane=sub(delta,mul(start.normal,dot(delta,start.normal)));if(Math.hypot(...Object.values(plane))>.3)direction=unit(plane);}
  if(phase==='up'){refresh(true);start=undefined;}else refresh();
 };
 if(viewer){viewer.onFreePointer=pick;viewer.onFreeSelect=id=>{el<HTMLSelectElement>('free-selection').value=id;showSelection();};}
 const showSelection=()=>{const e=selected();if(!e)return;list.value=e.equipmentId;el<HTMLInputElement>('free-heading').value=String(e.headingDegrees);el<HTMLInputElement>('free-launch-tilt').value=String(e.launchTiltDegrees??0);syncModule();status(`${e.id} · ${e.equipmentId} · ${e.platform.kind}\nParent ${e.anchor.structureId} / ${e.anchor.surfaceId}\nPose ${JSON.stringify(e.pose)}\n`+[...new Set(e.arc.map(s=>s.elevation))].map(p=>`${p}° elevation: clear yaw [${e.arc.filter(s=>s.clear&&s.elevation===p).map(s=>s.yaw).join(', ')}]`).join('\n')+'\nExternal samples only; generated base weapons are read-only');};
 el('free-selection').onchange=showSelection;
 el('free-on').onchange=()=>{viewer?.setFreeEditor(enabled());if(enabled()){viewer?.setEquipmentPreview();(document.getElementById('equipment-preview-on') as HTMLInputElement).checked=false;}cancel();};
 el('free-confirm').onclick=()=>{if(latestRequest)send(latestRequest,false,true);};el('free-cancel').onclick=cancel;
 const syncModule=()=>{const tilt=el<HTMLInputElement>('free-launch-tilt');tilt.disabled=list.value==='test-pod'||FREE_EQUIPMENT.find(e=>e.id===list.value)?.kind!=='MISSILE';if(tilt.disabled)tilt.value='0';};syncModule();
 for(const id of ['free-heading','free-launch-tilt','free-equipment','free-mode','free-count','free-spacing','free-platform','free-snap','free-mirror-battery'])el(id).onchange=()=>refresh();
 list.onchange=()=>{syncModule();refresh();};
 const editSetup=()=>{const entry=selected();if(!entry)return;list.value=entry.equipmentId;el<HTMLInputElement>('free-heading').value=String(entry.headingDegrees);el<HTMLInputElement>('free-launch-tilt').value=String(entry.launchTiltDegrees??0);syncModule();replacing=selectedIds();anchor=entry.anchor;start=undefined;direction=undefined;const group=(history!.blueprint.freeMountPlan?.entries??[]).filter(e=>replacing.includes(e.id));el<HTMLSelectElement>('free-mode').value=entry.batteryId&&group.length>2?'BATTERY':entry.pairId&&group.length>1?'MIRROR':'SINGLE';if(entry.batteryId&&group.length>2){const rows=group.filter(e=>Math.sign(e.anchor.position.x)===Math.sign(entry.anchor.position.x));el<HTMLInputElement>('free-count').value=String(rows.length);el<HTMLInputElement>('free-mirror-battery').checked=rows.length!==group.length;if(rows.length>1){direction=unit(sub(rows[1].anchor.position,rows[0].anchor.position));el<HTMLInputElement>('free-spacing').value=String(Math.hypot(...Object.values(sub(rows[1].anchor.position,rows[0].anchor.position))));anchor=rows[0].anchor;}}return entry;};
 el('free-move').onclick=()=>{if(editSetup())status('Move group: pick a new surface; old installation stays until validated commit');};
 el('free-rotate').onclick=()=>{const heading=el<HTMLInputElement>('free-heading').value,tilt=el<HTMLInputElement>('free-launch-tilt').value;if(editSetup()){el<HTMLInputElement>('free-heading').value=heading;el<HTMLInputElement>('free-launch-tilt').value=tilt;refresh(true);}};
 el('free-clone').onclick=()=>{if(editSetup()){replacing=[];status('Clone: pick another surface to place');}};
 el('free-mirror-clone').onclick=()=>{if(editSetup()){if(el<HTMLSelectElement>('free-mode').value==='BATTERY')el<HTMLInputElement>('free-mirror-battery').checked=true;else el<HTMLSelectElement>('free-mode').value='MIRROR';refresh(true);}};
 el('free-delete').onclick=()=>{try{if(history){history.remove(selectedIds());changed();cancel();}}catch(e){status(String(e));}};
 el('free-clear').onclick=()=>{try{if(history){history.remove((history.blueprint.freeMountPlan?.entries??[]).map(e=>e.id));changed();cancel();}}catch(e){status(String(e));}};
 el('free-undo').onclick=()=>{history?.undo();changed();cancel();};el('free-redo').onclick=()=>{history?.redo();changed();cancel();};
 el('free-save').onclick=()=>document.getElementById('export')!.click();el('free-load').onclick=()=>document.getElementById('import')!.click();
 return{reset(){worker?.terminate();worker=undefined;lastBlueprint=undefined;busy=false;pending=undefined;installing=false;const b=get();history=b.schemaVersion===2&&b.productionDesign?new EquipmentHistory(b):undefined;el<HTMLInputElement>('free-on').disabled=!history;if(!history)el<HTMLInputElement>('free-on').checked=false;panel.hidden=b.schemaVersion!==2;populate();viewer?.setFreeEditor(enabled());cancel();if(!history)status('Historical playback: Free-Mount needs a Production exterior Blueprint. No regeneration was applied.');},getHistory:()=>history};
}
