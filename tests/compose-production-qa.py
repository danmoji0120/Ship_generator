"""Compact, labelled evidence; raw bulk thumbnails stay outside the Git repository."""
from pathlib import Path
from PIL import Image,ImageDraw
import json
root=Path('qa/v1.8.4');out=root/'contacts';out.mkdir(exist_ok=True)
def sheet(cells,path,columns=4):
 w,h=640,356;canvas=Image.new('RGB',(w*columns,h*((len(cells)+columns-1)//columns)), '#172431');d=ImageDraw.Draw(canvas)
 for i,(label,files) in enumerate(cells):
  x,y=(i%columns)*w,(i//columns)*h
  for j,p in enumerate(files):
   if p.exists():
    a=Image.open(p).convert('RGB');a.thumbnail((w//len(files),320));canvas.paste(a,(x+j*w//len(files)+(w//len(files)-a.width)//2,y+25+(320-a.height)//2))
  d.text((x+9,y+6),label,fill='white')
 canvas.save(path,quality=90)
phase=root/'final'/'phase-b-final'
sheet([(f'WEDGE CITADEL / seed {s}',[phase/f'aegis-300-WEDGE_CITADEL-{s}-ISOMETRIC.png',phase/f'aegis-300-WEDGE_CITADEL-{s}-LOW-ISOMETRIC.png']) for s in [7,11,23,41]],out/'wedge-seeds.jpg',2)
rows=json.load(open(root/'regression-release'/'samples.json'))['rows'];thumbs=Path('/tmp/shipyard-v184-thumbnails')
for yard,arch in sorted(set((r['shipyardId'],r['architecture'])for r in rows)):
 group=[r for r in rows if r['shipyardId']==yard and r['architecture']==arch];sheet([(f'{yard} / seed {r["seed"]} / {r.get("family","FAILED")}',[thumbs/f'{yard}-{arch}-{r["seed"]}-ISOMETRIC.png',thumbs/f'{yard}-{arch}-{r["seed"]}-LOW-ISOMETRIC.png'])for r in group],out/f'{yard}-{arch}.jpg')

release=root/'release'
r=json.load(open(release/'report.json'))['rows']
family=[v for v in r if v.get('shipyardId','aegis')=='aegis' and v['seed']==7]
sheet([(v['family'],[(release if v['family']=='WEDGE_CITADEL' else root/'release-fit')/f'aegis-{v["family"]}-7/ISOMETRIC.png',(release if v['family']=='WEDGE_CITADEL' else root/'release-fit')/f'aegis-{v["family"]}-7/LOW-ISOMETRIC.png'])for v in family],out/'families.jpg',2)
yards=[v for v in r if v['family']=='HAMMERHEAD']
sheet([(v.get('shipyardId','aegis')+' / HAMMERHEAD / seed7',[(root/'release-fit')/f'{v.get("shipyardId","aegis")}-HAMMERHEAD-7/ISOMETRIC.png',(root/'release-fit')/f'{v.get("shipyardId","aegis")}-HAMMERHEAD-7/LOW-ISOMETRIC.png'])for v in yards],out/'shipyards.jpg',2)
base=release/'aegis-WEDGE_CITADEL-7'
sheet([(stage,[base/f'{stage}-{view}.png' for view in ['ISOMETRIC','LOW-ISOMETRIC']])for stage in ['HULL_ONLY','PRIMARY','NO_HARDPOINTS']],out/'structure-progression.jpg',1)
# The source and new capture both use a fixed 360m frame. Only pixel resolution is resampled.
sheet([('V1.8.3 stored approved / fixed 360m',[Path('qa/v1.8.3/final-review/complete-ISOMETRIC.png'),Path('qa/v1.8.3/final-review/complete-LOW-ISOMETRIC.png')]),('V1.8.4 regenerated Order + Seed / fixed 360m',[base/'ISOMETRIC.png',base/'LOW-ISOMETRIC.png'])],out/'before-after.jpg',1)
