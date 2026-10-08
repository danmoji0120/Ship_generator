"""Analyze real rendered orthographic masks, then assemble reproducible visual review sheets."""
import json, math, itertools, statistics
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np
ROOT=Path('qa/v1.8');RAW=Path('/tmp/shipyard-v18-images')
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=ImageFont.truetype(FONT,13);titlefont=ImageFont.truetype(FONT,21)
r=json.loads((ROOT/'render-report.json').read_text())
def photo(path,size,bg='#102031'):
    image=Image.open(path).convert('RGBA');image.thumbnail(size);base=Image.new('RGB',size,bg);base.paste(image,((size[0]-image.width)//2,(size[1]-image.height)//2),image);return base
def sheet(rows,path,title,cols=5,cell=(310,240),white=False):
    bg='#ffffff' if white else '#102031';fg='#17232c' if white else '#e9eef1';w,h=cell;out=Image.new('RGB',(w*cols,math.ceil(len(rows)/cols)*h+54),bg);d=ImageDraw.Draw(out);d.text((15,14),title,font=titlefont,fill=fg)
    for i,(p,label) in enumerate(rows):
        x=(i%cols)*w;y=(i//cols)*h+54;out.paste(photo(p,(w,h-44),bg),(x,y));
        for j,line in enumerate(label.split('\n')):d.text((x+8,y+h-40+j*17),line,font=font,fill=fg)
    out.save(path)
def mask(path):return np.asarray(Image.open(path).convert('L').resize((96,96),Image.Resampling.LANCZOS))<128
def bits(m):return int.from_bytes(np.packbits(m.ravel()).tobytes(),'big')
def convex(points):
    points=sorted(set(points))
    def cross(o,a,b):return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lower=[];upper=[]
    for p in points:
        while len(lower)>1 and cross(lower[-2],lower[-1],p)<=0:lower.pop()
        lower.append(p)
    for p in reversed(points):
        while len(upper)>1 and cross(upper[-2],upper[-1],p)<=0:upper.pop()
        upper.append(p)
    return lower[:-1]+upper[:-1]
def features(m):
    ys,xs=np.where(m);eroded=m.copy()
    for axis in [0,1]:eroded&=np.roll(m,1,axis)&np.roll(m,-1,axis)
    contour=m&~eroded
    hull=Image.new('1',(96,96));ImageDraw.Draw(hull).polygon(convex(zip(xs.tolist(),ys.tolist())),fill=1);area=np.asarray(hull).sum()
    return {'pixels':int(m.sum()),'aspectRatio':float((xs.max()-xs.min()+1)/(ys.max()-ys.min()+1)),'centroid':[float(xs.mean()/96),float(ys.mean()/96)],'contourPixels':int(contour.sum()),'negativeSpaceFraction':float(max(0,area-m.sum())/max(1,area))},bits(contour)
stats={}; groups={}
for rec in r['records']:
    masks={};f={}
    for view in ['TOP','SIDE','FRONT','ISOMETRIC']:
        m=mask(ROOT/'silhouettes'/f"{rec['key']}-{view}-normalized.png");ft,co=features(m);f[view]=ft;masks[view]=(bits(m),co)
    rec['pixelFeatures']=f;stats[rec['key']]=masks;groups.setdefault((rec['yard'],rec['architecture']),[]).append(rec)
diversity=[]
for (yard,architecture),rows in groups.items():
    pairs=[]
    for a,b in itertools.combinations(rows,2):
        viewmetrics={}
        for view in ['TOP','SIDE','FRONT','ISOMETRIC']:
            x,c=stats[a['key']][view];y,d=stats[b['key']][view];viewmetrics[view]={'iou':(x&y).bit_count()/max(1,(x|y).bit_count()),'contourIou':(c&d).bit_count()/max(1,(c|d).bit_count())}
        pairs.append({'a':a['seed'],'b':b['seed'],'sameFamily':a['family']==b['family'],'meanIou':statistics.mean(v['iou'] for v in viewmetrics.values()),'views':viewmetrics})
    near=[p for p in pairs if p['meanIou']>.94 and p['views']['TOP']['iou']>.96]
    diversity.append({'yard':yard,'architecture':architecture,'families':{f:sum(x['family']==f for x in rows) for f in sorted(set(x['family'] for x in rows))},'compositions':sorted(set(x['composition'] for x in rows)),
      'meanPairIou':statistics.mean(p['meanIou'] for p in pairs),'meanTopIou':statistics.mean(p['views']['TOP']['iou'] for p in pairs),'medianTopIou':statistics.median(p['views']['TOP']['iou'] for p in pairs),'p95TopIou':sorted(p['views']['TOP']['iou'] for p in pairs)[int(.95*len(pairs))-1],
      'nearRepeatWarnings':near,'pairs':pairs})
    prefix=f'{yard}-{architecture}'
    sheet([(RAW/f"{x['key']}-iso.png",f"SEED {x['seed']} / {x['family']}\n{x['composition']}") for x in rows],ROOT/f'{prefix}-normal.png',f'{yard.upper()} / {architecture} / continuous seeds 0-19')
    for view in ['TOP','SIDE','FRONT','ISOMETRIC']:
      sheet([(ROOT/'silhouettes'/f"{x['key']}-{view}-normalized.png",f"{x['seed']} / {x['family']}\n{x['composition']}") for x in rows],ROOT/f'{prefix}-{view}.png',f'{yard.upper()} / {architecture} / {view} / normalized orthographic',white=True)
# Same pose before/after, both pixels in each pair retain the original 960 x 620 camera.
for yard in ['aegis','vesper','forge','serein']:
    sheet([(ROOT/era/f'{yard}-{seed}.png',f"{yard.upper()} / SEED {seed} / {'V1.7' if era=='before' else 'V1.8'}\nIdentical camera, perspective, viewport") for seed in [0,7,13] for era in ['before','after']],ROOT/f'comparison-{yard}.png',f'V1.7 -> V1.8 / {yard.upper()} / same Order, Seed, camera and physical scale',cols=2,cell=(620,445))
for f in r['familyGallery']:
    family=f['family'];rows=[(RAW/f'family-{family}-normal.png','Normal / integrated hull')]+[(RAW/f'family-{family}-{view}.png',view+' / normalized orthographic') for view in ['TOP','SIDE','FRONT','ISOMETRIC','MASS']]
    sheet(rows,ROOT/f'family-{family}.png',family+' / '+f['architecture'],cols=3,cell=(420,320),white=True)
# A fixed-scale top gallery explicitly exposes physical-width differences concealed by auto fit.
for architecture in ['BLOCK_ASSEMBLY','MONOLITHIC']:
    rows=groups[('forge',architecture)];sheet([(ROOT/'silhouettes'/f"{x['key']}-TOP-fixed.png",f"SEED {x['seed']} / {x['family']}\n300 m hull / 495 m frame") for x in rows],ROOT/f'forge-{architecture}-fixed-TOP.png',architecture+' / fixed physical scale (300 m hull, 495 m square frame)',white=True)
perf={}
for version in ['1.7','1.8']:
    times=sorted(x['ms'] for x in r['benchmarks'] if x['version']==version)
    paired=[x for x in r['comparisons'] if x['architecture']=='BLOCK_ASSEMBLY'];draws=[x['before' if version=='1.7' else 'after']['drawCalls'] for x in paired];tris=[x['before' if version=='1.7' else 'after']['triangles'] for x in paired]
    perf[version]={'medianGenerationMs':statistics.median(times),'p95GenerationMs':times[int(.95*len(times))-1],'meanDrawCalls':statistics.mean(draws),'meanTriangles':statistics.mean(tris),'maxDrawCalls':max(draws),'maxTriangles':max(tris),'cpuSamples':len(times),'renderSamples':len(draws)}
old_matrix=json.loads(Path('qa/v1.7/render-report.json').read_text())['records']
perf['fullMatrix']={'scope':'220 same configurations; archived V1.7 renderer stats vs current V1.8','1.7':{'meanDrawCalls':statistics.mean(x['frames'][0]['diagnostics']['drawCalls']for x in old_matrix),'meanTriangles':statistics.mean(x['frames'][0]['diagnostics']['triangles']for x in old_matrix),'maxDrawCalls':max(x['frames'][0]['diagnostics']['drawCalls']for x in old_matrix)},'1.8':{'meanDrawCalls':statistics.mean(x['diagnostics']['drawCalls']for x in r['records']),'meanTriangles':statistics.mean(x['diagnostics']['triangles']for x in r['records']),'maxDrawCalls':max(x['diagnostics']['drawCalls']for x in r['records']),'maxTriangles':max(x['diagnostics']['triangles']for x in r['records'])}}
(ROOT/'performance.json').write_text(json.dumps(perf,indent=2));(ROOT/'silhouette-metrics.json').write_text(json.dumps({'method':'Actual WebGL masks, 320px orthographic -> 96px threshold masks. Same max-axis frame; preserved aspect ratio. Warning: mean four-view IoU > .94 AND TOP IoU > .96; advisory, not a test gate. Contour IoU and convex-hull empty-space fraction accompany it.','groups':diversity},indent=2));
(ROOT/'pixel-features.json').write_text(json.dumps([{k:x[k] for k in ['key','family','composition','pixelFeatures']} for x in r['records']],indent=2))
print(json.dumps({'performance':perf,'groups':[{k:x[k] for k in ['yard','architecture','families','meanPairIou','meanTopIou']}|{'warnings':len(x['nearRepeatWarnings'])} for x in diversity]},indent=2))

sheet([(ROOT/era/f'forge-MONOLITHIC-{seed}.png',f'FORGE / SEED {seed} / '+('V1.7' if era=='before' else 'V1.8'))for seed in [0,7,13]for era in ['before','after']],ROOT/'comparison-MONOLITHIC.png','MONOLITHIC / same Order, Seed and original physical camera',cols=2,cell=(620,445))
sheet([(RAW/f'neutral-{y}.png',y.upper()+' / HAMMERHEAD / 7')for y in ['aegis','vesper','forge','serein']],ROOT/'shipyard-forced-neutral.png','Same architecture / Family / Seed / neutral palette',cols=4)
sheet([(RAW/f'forced-{y}-TOP.png',y.upper()+' / HAMMERHEAD / 7')for y in ['aegis','vesper','forge','serein']],ROOT/'shipyard-forced-TOP.png','Same architecture / Family / Seed / actual black geometry',cols=4,white=True)
sheet([(RAW/f'debug-{y}-{m}.png',y.upper()+' / '+m)for y in ['aegis','vesper','forge','serein']for m in ['Integration','Armor','Equipment']],ROOT/'integration-armor-gallery.png','Existing V1.7 fitted exterior / Macro major masses',cols=3,cell=(400,300))
sheet([(RAW/f'{y}-BLOCK_ASSEMBLY-{s}-{v}.png',y.upper()+f' / {s} / {v}')for y in ['aegis','vesper','forge','serein']for s in [0,7]for v in ['front','rear']],ROOT/'bow-stern-gallery.png','Macro bows and unobstructed rear propulsion / continuous samples',cols=4)

# The same 20 consecutive legacy seeds are measured by the identical WebGL projection.
legacy=[]
for architecture in ['MONOLITHIC','BLOCK_ASSEMBLY']:
 rows=[];masks=[]
 for seed in range(20):
  key=f'forge-{architecture}-{seed}';masks.append({v:bits(mask(ROOT/'v17-silhouettes'/f'{key}-{v}-normalized.png'))for v in ['TOP','SIDE','FRONT','ISOMETRIC']});rows.append((ROOT/'v17-silhouettes'/f'{key}-TOP-normalized.png',f'V1.7 / SEED {seed}'))
 pairs=[]
 for a,b in itertools.combinations(range(20),2):
  values={v:(masks[a][v]&masks[b][v]).bit_count()/max(1,(masks[a][v]|masks[b][v]).bit_count())for v in ['TOP','SIDE','FRONT','ISOMETRIC']};pairs.append({'a':a,'b':b,'views':values})
 new=next(g for g in diversity if g['yard']=='forge'and g['architecture']==architecture)
 legacy.append({'architecture':architecture,'consecutiveSeedRange':[0,19],'legacyMeanTopIou':statistics.mean(p['views']['TOP']for p in pairs),'newMeanTopIou':new['meanTopIou'],'legacyMeanFourViewIou':statistics.mean(statistics.mean(p['views'].values())for p in pairs),'newMeanFourViewIou':new['meanPairIou'],'pairs':pairs})
 sheet(rows,ROOT/f'v17-forge-{architecture}-TOP.png',f'V1.7 / {architecture} / same 20 seeds, projection and frame',white=True)
(ROOT/'v17-v18-diversity.json').write_text(json.dumps(legacy,indent=2))
print('Actual legacy / new diversity comparison:',json.dumps([{k:v for k,v in g.items()if k!='pairs'}for g in legacy],indent=2))
