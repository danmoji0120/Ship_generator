"""Compose saved real WebGL renders. Requires Pillow only for this QA command."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,os
root=Path(os.environ.get('INTEGRATION_OUTPUT','qa/v1.7'));raw=Path(os.environ.get('INTEGRATION_RAW','/tmp/shipyard-v17-images'))
try:
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
 large=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',21)
except OSError:
 font=large=ImageFont.load_default()
arches=['MONOLITHIC','BLOCK_ASSEMBLY','SPINE_AND_MODULES','TRUSS_POD','TWIN_HULL','CORE_AND_NACELLES','STACKED_BLOCKS','HYBRID']
views=['iso','top','side','front','rear']
report=json.load(open(root/'render-report.json')) if (root/'render-report.json').exists() else {'records':[]}
patterns={(r['yard'],r['grammar'],r['seed']):r['composition'] for r in report['records']}
def sheet(filename,title,cards,cols=4,cell=(400,285)):
 rows=(len(cards)+cols-1)//cols;w,h=cell
 out=Image.new('RGB',(w*cols,h*rows+60),(16,27,39));draw=ImageDraw.Draw(out);draw.text((15,16),title,font=large,fill=(223,235,244))
 for i,(path,label) in enumerate(cards):
  x=(i%cols)*w;y=(i//cols)*h+60
  im=Image.open(path).convert('RGBA');im.thumbnail((w-8,h-34),Image.Resampling.LANCZOS)
  bg=Image.new('RGBA',im.size,(22,37,53,255));bg.alpha_composite(im);out.paste(bg.convert('RGB'),(x+(w-im.width)//2,y+26+(h-34-im.height)//2))
  draw.text((x+10,y+6),label,font=font,fill=(204,221,234))
 out.save(root/filename,optimize=True)
for a in arches:
 files=[raw/f'forge-{a}-{s}-iso.png' for s in range(20)]
 if all(p.exists() for p in files):
  sheet(f'contact-{a}.png',f'V1.7 / FORGE / CRUISER / {a} / seeds 0-19',[(p,f'SEED {s} / {patterns.get(("forge",a,s),"")}')for s,p in enumerate(files)])
  cards=[(raw/f'forge-{a}-{s}-{v}.png',f'SEED {s} / {v.upper()}')for s in [0,7,13] for v in views]
  if all(p.exists() for p,_ in cards):sheet(f'views-{a}.png',f'V1.7 / {a} / five inspection directions',cards,5,(320,235))
for yard in ['aegis','vesper','serein']:
 cards=[(raw/f'{yard}-BLOCK_ASSEMBLY-{s}-iso.png',f'SEED {s}')for s in range(20)]
 if all(p.exists()for p,_ in cards):sheet(f'contact-{yard}-BLOCK_ASSEMBLY.png',f'V1.7 / {yard.upper()} / same BLOCK_ASSEMBLY order / seeds 0-19',cards)
cards=[(raw/f'{yard}-BLOCK_ASSEMBLY-{s}-iso.png',f'{yard.upper()} / SEED {s}')for s in [0,7,13] for yard in ['aegis','vesper','forge','serein']]
if all(p.exists()for p,_ in cards):sheet('shipyard-comparison.png','V1.7 / same role, architecture and seed / four structural doctrines',cards)
for yard in ['aegis','vesper','forge','serein']:
 cards=[(root/phase/f'{yard}-{s}.png',f'{"V1.6" if phase=="before" else "V1.7"} / SEED {s}') for s in [0,7,13] for phase in ['before','after']]
 if all(p.exists()for p,_ in cards):sheet(f'before-after-{yard}.png',f'{yard.upper()} / same order + seed + camera / V1.6 vs V1.7',cards,2,(700,480))
cards=[(raw/f'debug-{y}-{m}.png',f'{y.upper()} / {m.upper()}') for y in ['aegis','vesper','forge','serein']for m in ['Integration','Armor','Equipment']]
if all(p.exists()for p,_ in cards):sheet('integration-armor-gallery.png','V1.7 / station-fitted integration, protection and functional housings',cards,3,(480,330))
cards=[(raw/f'{y}-BLOCK_ASSEMBLY-{s}-{v}.png',f'{y.upper()} / SEED {s} / {v.upper()}')for y in ['aegis','vesper','forge','serein']for s in [0,7]for v in ['front','rear']]
if all(p.exists()for p,_ in cards):sheet('bow-stern-gallery.png','V1.7 / purposeful bow rims and unobstructed propulsion casing',cards,4)
print('Composed available contact sheets and galleries.')

cards=[(root/f'engine-clearance-{y}-{phase}.png',f'{y.upper()} / {phase.upper()} / SAME CAMERA')for y in ['aegis','forge']for phase in ['before','after']]
if all(p.exists()for p,_ in cards):sheet('errors-and-fixes.png','Overlapping V1.6 bells -> spacing-limited V1.7 open engine casing',cards,2,(620,430))

cards=[(root/f'neutral-{y}.png',y.upper())for y in ['aegis','vesper','forge','serein']]
if all(p.exists()for p,_ in cards):sheet('shipyard-neutral-comparison.png','V1.7 / same BLOCK_ASSEMBLY, seed 7 / identical material palette',cards,4)

cards=[(raw/f'forge-{a}-0-{v}.png',f'{a} / {v.upper()}')for a in arches for v in views]
if all(p.exists()for p,_ in cards):sheet('overview-five-views.png','V1.7 / all 8 architectures / seed 0 / five inspection directions',cards,5,(320,235))
