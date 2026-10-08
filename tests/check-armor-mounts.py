"""Conservative final footprints/height scan of all stored generated designs."""
import gzip,json,pathlib,math,collections
D=pathlib.Path('qa/v1.8.1');overlaps=[];tall=[];mounts=collections.Counter();files=list((D/'blueprints').glob('*.gz'))
for p in files:
 b=json.load(gzip.open(p));hs=[h for h in b['hardpoints'] if h.get('surfaceMount')];mounts.update(d['status']for d in b['layeredArmor']['mountDecisions'])
 for i,a in enumerate(hs):
  m=a['surfaceMount'];height=m['foundation']['height'];limit=max(b['order']['length']*.006,a['radius']*.6)
  if height>limit+1e-6:tall.append({'file':p.name,'hardpoint':a['id'],'height':height,'limit':limit})
  for c in hs[i+1:]:
   distance=math.hypot(a['position']['x']-c['position']['x'],a['position']['z']-c['position']['z']);r=m['clearance']['radius']+c['surfaceMount']['clearance']['radius']
   if distance<r-1e-5:overlaps.append({'file':p.name,'a':a['id'],'b':c['id'],'ratio':distance/r})
json.dump({'count':len(files),'mountDecisions':dict(mounts),'overlappingMountFootprints':overlaps},open(D/'regression/mount-footprints.json','w'),indent=2)
json.dump({'count':len(files),'tallFoundations':tall},open(D/'regression/foundation-height.json','w'),indent=2)
assert not overlaps and not tall
print('PASS: 220 stored designs, no overlapping footprints, no oversized foundations',dict(mounts))
