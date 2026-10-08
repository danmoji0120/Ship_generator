"""Actual WebGL image contact sheets / silhouette masks; no blueprint proxies."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json, statistics, math
import numpy as np
D=Path('qa/v1.8.1')
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=ImageFont.truetype(font_path,14)
small=ImageFont.truetype(font_path,11)
def sheet(rows,columns,path,tile=(360,240),title=''):
 w,h=tile;canvas=Image.new('RGB',(w*columns,math.ceil(len(rows)/columns)*(h+42)+38),'#172431');draw=ImageDraw.Draw(canvas)
 draw.text((12,10),title,fill='white',font=font)
 for i,(path0,label) in enumerate(rows):
  x=(i%columns)*w;y=(i//columns)*(h+42)+38
  image=Image.open(path0).convert('RGB');image.thumbnail((w,h));canvas.paste(image,(x+(w-image.width)//2,y+(h-image.height)//2));draw.text((x+8,y+h+7),label,fill='white',font=small)
 canvas.save(path)
report=json.load(open(D/'report.json'))
records=report['records']; groups={}
for r in records:groups.setdefault((r['yard'],r['architecture']),[]).append(r)
for (yard,arch),rs in groups.items():
 sheet([(D/'raw'/f'{yard}-{arch}-{r["seed"]}.png',f'{r["seed"]:02}  {r["family"]} / {sum(r["layerCounts"])} segments') for r in rs],4,D/f'{yard}-{arch}-contact.png',title=f'{yard.upper()} / {arch} / seeds 0-19')
 for view in ['SIDE','FRONT']:
  sheet([(D/'silhouettes'/f'{yard}-{arch}-{r["seed"]}-PRIMARY-{view}.png',f'{r["seed"]:02}  {r["family"]}')for r in rs],4,D/f'{yard}-{arch}-{view}.png',tile=(300,220),title=f'{yard.upper()} / {arch} / PRIMARY ENVELOPE / fixed ortho {view}')
for r in report['comparisons']:
 family=r['family'];seed=r['seed'];key=f'{family}-{seed}'
 stages=['HULL_ONLY','PRIMARY','SEAMS','COMPLETE'];views=['TOP','BOTTOM','LEFT','RIGHT','FRONT','AFT','ISOMETRIC']
 labels={'HULL_ONLY':'A / Hull only','PRIMARY':'B / Primary envelope','SEAMS':'C / Actual gaps / underlayer','COMPLETE':'D / Complete layered armor'}
 rows=[(D/'armor-progression'/f'{key}-{stage}-{view}.png',f'{view} / {labels[stage]}')for view in views for stage in stages]
 sheet(rows,4,D/'armor-progression'/f'{key}-progression.png',tile=(380,380),title=f'{family} seed {seed} / same camera, fixed 450m frame')
 sheet([(D/'before-after'/f'{key}-{state}.png',f'V{v} / same pose and physical scale')for state,v in [('before','1.8'),('after','1.8.1')]],2,D/'before-after'/f'{key}-comparison.png',tile=(600,388),title=f'{family} / {r["architecture"]} / seed {seed}')
 if seed==7:
  sheet([(D/'armor-progression'/f'{key}-{stage}-fit.png',labels[stage])for stage in stages],4,D/'family-comparison'/f'{family}.png',tile=(420,420),title=f'{family} / progression; all stages fit to the SAME Complete bounds')
  sheet([(D/'armor-gallery'/f'{key}-layer-{i}.png',f'Layer {i}')for i in [1,2,3]],3,D/'armor-gallery'/f'{family}-layers.png',tile=(420,420),title=f'{family} / stored armor only / no structural hull')
sheet([(D/'shipyard-comparison'/f'{yard}.png',yard.upper())for yard in ['aegis','vesper','forge','serein']],4,D/'shipyard-comparison'/'comparison.png',tile=(420,272),title='HAMMERHEAD / BLOCK_ASSEMBLY / seed 7 / yard armor languages')
for view in ['TOP','BOTTOM','LEFT','RIGHT','FRONT','AFT','ISOMETRIC']:
 sheet([(D/'neutral'/f'{yard}-{view}.png',yard.upper())for yard in ['aegis','vesper','forge','serein']],4,D/'neutral'/f'comparison-{view}.png',tile=(360,360),title=f'Neutral geometry / {view} / fixed world scale')
def mask(path):
 return np.asarray(Image.open(path).convert('L'))<128
def iou(a,b):return float((a&b).sum()/max(1,(a|b).sum()))
metrics=[]
for r in records:
 key=f'{r["yard"]}-{r["architecture"]}-{r["seed"]}'
 row={'yard':r['yard'],'architecture':r['architecture'],'family':r['family'],'seed':r['seed'],'coverage':r['coverage']['byDirectionRatio']}
 for view in ['TOP','SIDE','FRONT']:
  a=mask(D/'silhouettes'/f'{key}-HULL_ONLY-{view}.png');b=mask(D/'silhouettes'/f'{key}-PRIMARY-{view}.png');c=mask(D/'silhouettes'/f'{key}-SECONDARY-{view}.png')
  row[view]={'hullPrimaryIoU':iou(a,b),'primarySecondaryIoU':iou(b,c),'primaryAddedPixelRatio':float((b&~a).sum()/max(1,a.sum())),'primaryForegroundPixels':int(b.sum())}
 metrics.append(row)
family_metrics={}
for f in sorted(set(r['family']for r in records)):
 rs=[r for r in records if r['family']==f];ms=[m for m in metrics if m['family']==f]
 family_metrics[f]={'samples':len(rs),'primaryApplicationRate':sum(r['layerCounts'][0]>0 for r in rs)/len(rs),'secondaryApplicationRate':sum(r['layerCounts'][1]>0 for r in rs)/len(rs),'coverageMean':{k:statistics.mean(r['coverage']['byDirectionRatio'][k]for r in rs)for k in ['top','bottom','left','right','fore','aft']},'hullPrimaryIoUMean':{v:statistics.mean(m[v]['hullPrimaryIoU']for m in ms)for v in ['TOP','SIDE','FRONT']}}
def perf(rs,key):return {'mean':statistics.mean(r[key]for r in rs),'max':max(r[key]for r in rs)}
performance={}
for version in ['1.8','1.8.1']:
 ts=sorted(t['ms']for t in report['timings']if t['version']==version)
 rs=[r['before'if version=='1.8'else 'after'] for r in records]
 performance[version]={'cpuMedianMs':statistics.median(ts),'cpuP95Ms':ts[math.ceil(.95*len(ts))-1],'samples':len(ts),'drawCalls':perf(rs,'drawCalls'),'triangles':perf(rs,'triangles')}
summary={'records':metrics,'familyMetrics':family_metrics,'performance':performance,'coverageWarnings':[{k:r[k]for k in ['yard','architecture','seed','coverage']}for r in records if r['coverage']['warnings']],'macroPreservedAll':all(r['macroUnchanged']for r in records),'primarySegmentRange':[min(r['layerCounts'][0]for r in records),max(r['layerCounts'][0]for r in records)],'armorTriangleRange':[min(r['budget']['triangleCount']for r in records),max(r['budget']['triangleCount']for r in records)]}
json.dump(summary,open(D/'metrics.json','w'),indent=2)
json.dump(performance,open(D/'performance.json','w'),indent=2)
print(json.dumps({'performance':performance,'familyMetrics':family_metrics,'coverageWarnings':len(summary['coverageWarnings'])},indent=2))

for r in report['comparisons']:
 key=f'{r["family"]}-{r["seed"]}'
 sheet([(D/'hardpoint-comparison'/f'{key}-{stage}-{view}.png',f'{stage} / {view}')for view in ['TOP','ISOMETRIC']for stage in ['NO_HARDPOINTS','COMPLETE']],2,D/'hardpoint-comparison'/f'{key}-comparison.png',tile=(480,480),title=f'{key} / exact same armor; surface foundations mounted')
 sheet([(D/'seam-closeups'/f'{key}-{view}.png',view)for view in ['ISOMETRIC','RIGHT']],2,D/'seam-closeups'/f'{key}-closeup.png',tile=(600,600),title=f'{key} / real bevel + gap walls / 60m fixed world frame')
 sheet([(D/'armor-progression'/f'{key}-PRIMARY-{view}.png',view)for view in ['TOP','BOTTOM','LEFT','RIGHT','FRONT','AFT','ISOMETRIC']],4,D/'armor-coverage'/f'{key}-coverage.png',tile=(360,360),title=f'{key} / 7 lit directions; 6 eligible surface areas')

sheet([(D/'neutral'/f'{yard}-{view}.png',f'{yard.upper()} / {view}')for view in ['TOP','LEFT','BOTTOM','FRONT']for yard in ['aegis','vesper','forge','serein']],4,D/'panel-gallery'/'patterns-neutral.png',tile=(360,360),title='Surface-conforming panel patterns / 4 yards / neutral material')
