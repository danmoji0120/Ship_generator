from PIL import Image,ImageDraw,ImageFont,ImageChops
import json,hashlib
from pathlib import Path
p=Path('qa/v1.8.5.4.2');font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
def sheet(name,rows):
 w,h=720,500;im=Image.new('RGB',(w*2,h*len(rows)),(13,22,31));d=ImageDraw.Draw(im)
 for j,row in enumerate(rows):
  for i,(file,label) in enumerate(row):
   x=Image.open(p/file).convert('RGB');x.thumbnail((w,h-40));im.paste(x,(i*w+(w-x.width)//2,j*h+40));d.text((i*w+14,j*h+10),label,font=font,fill=(221,234,245))
 im.save(p/name,quality=88)
sheet('470-battery-before-after.jpg',[[('470-off-top.png','470m / Seed 7 / OFF — TOP'),('470-refined-top.png','Preview: paired 210mm battery, 3 per side')],[('470-off-iso.png','OFF — ISOMETRIC'),('470-refined-iso.png','ON — ISOMETRIC')],[('470-off-side.png','OFF — SIDE'),('470-refined-side.png','ON — SIDE')]])
sheet('equipment-gallery.jpg',[[('large-before.png','406mm pair / close-up — OFF'),('large-closeup.png','406mm pair / ON + sampled arc debug')],[('470-missile-iso.png','Medium missile pair / valid initial paths'),('470-battery-arcs.png','210mm battery / limited operating arcs')],[('470-large-top.png','406mm pair — TOP'),('470-large-front.png','406mm pair — FRONT')]])
sheet('representative-ships.jpg',[[ (f'{name}-iso-off.png',f'{name} / OFF'),(f'{name}-iso-on.png',f'{name} / equipment ON')]for name in ['stacked-blocks','spinal-modules','truss-pods']])
r=json.load(open(p/'render-report.json'));a=json.load(open(p/'representatives-report.json'))
for case in r['plans']:
 for item in case['results']:
  samples=item.pop('samples');item['clearSamples']=sum(s['clear'] for s in samples);item['testedSamples']=len(samples);item['blockedBy']=sorted({x for s in samples for x in s['blockers']})[:8]
  if case['name'] in ['refined','large','missile']:item['clearYawByElevation']={str(e):[s['yaw'] for s in samples if s['elevation']==e and s['clear']] for e in sorted({s['elevation'] for s in samples})}
x=r.pop('xl');examples={}
for t in x['attempts']:
 for reason in t['reasons']:examples.setdefault(reason.split(':')[0],t)
json.dump({'attempts':len(x['attempts']),'counts':x['counts'],'examples':examples,'limitations':x['limitations']},open(p/'xl-summary.json','w'),indent=2)
r['pixelRestoration']={}
for v in ['top','front','side','iso']:
 left=p/f'470-off-{v}.png';right=p/f'470-restored-{v}.png';eq=ImageChops.difference(Image.open(left).convert('RGB'),Image.open(right).convert('RGB')).getbbox() is None;r['pixelRestoration'][v]={'equal':eq,'baselinePngSha256':hashlib.sha256(left.read_bytes()).hexdigest()}
r['pixelRestoration']['largeCloseup']=ImageChops.difference(Image.open(p/'large-before.png').convert('RGB'),Image.open(p/'large-restored.png').convert('RGB')).getbbox() is None
json.dump(r,open(p/'render-summary.json','w'),indent=2)
for case in a['report']:
 for item in case['results']:
  samples=item.pop('samples');item['clearSamples']=sum(s['clear'] for s in samples);item['testedSamples']=len(samples)
json.dump(a,open(p/'representatives-summary.json','w'),indent=2)
