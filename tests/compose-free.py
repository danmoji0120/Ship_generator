from PIL import Image,ImageDraw,ImageFont,ImageChops
import json
from pathlib import Path
p=Path('qa/v1.8.5.5');font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
def sheet(name,rows):
 w,h=720,500;im=Image.new('RGB',(w*2,h*len(rows)),(13,22,31));d=ImageDraw.Draw(im)
 for j,row in enumerate(rows):
  for i,(file,label) in enumerate(row):
   x=Image.open(p/file).convert('RGB');x.thumbnail((w,h-40));im.paste(x,(i*w+(w-x.width)//2,j*h+40));d.text((i*w+14,j*h+10),label,font=font,fill=(221,234,245))
 im.save(p/name,quality=88)
sheet('470-free-mount-before-after.jpg',[[('470-'+v+'-before.png','470m / Seed 7 / BEFORE — '+v.upper()),('470-'+v+'-after.png','FREE MOUNT — '+v.upper())]for v in ['top','front','side','iso']])
sheet('platform-closeups.jpg',[[('470-pylon-before.png','Utility pylon region — BEFORE'),('470-pylon-after.png','Two real support roots + external pod')],[('main-gun-closeup.png','500mm gun / actual support'),('side-missile-closeup.png','Side missile / outward exits')],[('truss-pods-pylon-before.png','TRUSS_POD — BEFORE'),('truss-pods-pylon-after.png','TRUSS_POD — attached utility pod')]])
sheet('architecture-comparison.jpg',[[ (f'{name}-iso-before.png',name+' / BEFORE'),(f'{name}-iso-after.png',name+' / FREE MOUNT')]for name in ['stacked-blocks','spinal-modules','truss-pods']])
x=json.load(open(p/'scenario-results.json'));r=json.load(open(p/'render-report.json'));json.dump({'scenarios':x,'render':r,'historicalPixels':json.load(open(p/'historical-pixels.json')) if (p/'historical-pixels.json').exists() else None,'productionUI':json.load(open(p/'production-ui-report.json')) if (p/'production-ui-report.json').exists() else None},open(p/'summary.json','w'),indent=2)
if (p/'editor.png').exists():Image.open(p/'editor.png').convert('RGB').save(p/'editor.jpg',quality=85)
