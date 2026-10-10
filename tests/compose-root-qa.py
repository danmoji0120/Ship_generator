from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]/'qa/v1.8.5.3.1'
source=root/'render'; out=root/'review';out.mkdir(exist_ok=True)
def sheet(name,rows,w=500,comparison=True):
 h=0;images=[]
 for label,a,b in rows:
  pair=[]
  for path in [a,b]:
   im=Image.open(source/path).convert('RGB');im.thumbnail((w,w));pair.append(im)
  rh=max(im.height for im in pair)+28;images.append((label,pair,rh));h+=rh
 canvas=Image.new('RGB',(w*2,h),'#192735');d=ImageDraw.Draw(canvas);y=0
 for label,pair,rh in images:
  for i,im in enumerate(pair):canvas.paste(im,(i*w,y+28));d.text((i*w+8,y+8),(label+(' / BEFORE' if i==0 else ' / AFTER')) if comparison else label.split('|')[i],fill='white')
  y+=rh
 canvas.save(out/name,quality=88)
sheet('engine-root-closeups.jpg',[(yard, f'{yard}-before-AFT.png',f'{yard}-after-AFT.png') for yard in ['aegis','vesper','forge','serein']])
sheet('engine-root-whole.jpg',[(yard,f'{yard}-whole-before.png',f'{yard}-whole-after.png') for yard in ['vesper','forge','serein']])
sheet('sparse-architectures.jpg',[(a,f'{a}-before-ISOMETRIC.png',f'{a}-after-ISOMETRIC.png') for a in ['TRUSS_POD','HYBRID','SPINE_AND_MODULES','CORE_AND_NACELLES','TWIN_HULL']])
sheet('sparse-bottom.jpg',[(a,f'{a}-before-BOTTOM.png',f'{a}-after-BOTTOM.png') for a in ['TRUSS_POD','HYBRID','SPINE_AND_MODULES','CORE_AND_NACELLES','TWIN_HULL']])
print(out)

source=root/'diagnostics'
sheet('engine-root-large.jpg',[(yard,f'{yard}-large-before-ISOMETRIC.png',f'{yard}-large-after-ISOMETRIC.png') for yard in ['vesper','forge','serein']],600)
sheet('engine-root-large-aft.jpg',[(yard,f'{yard}-large-before-AFT.png',f'{yard}-large-after-AFT.png') for yard in ['vesper','forge','serein']],600)
sheet('engine-root-large-side.jpg',[(yard,f'{yard}-large-before-LEFT.png',f'{yard}-large-after-LEFT.png') for yard in ['vesper','forge','serein']],600)
variants=['WIDE_ROOT_FAIRING','NARROW_ROOT_FAIRING','SEGMENTED_ROOT_SUPPORT','LOW_PROFILE_TRANSITION']
sheet('engine-root-variants.jpg',[(variants[i]+'|'+variants[i+1],variants[i]+'.png',variants[i+1]+'.png') for i in [0,2]],600,comparison=False)

sheet('engine-root-rear.jpg',[(yard,f'{yard}-rear-before.png',f'{yard}-rear-after.png') for yard in ['aegis','vesper','forge','serein']],600)
sheet('engine-root-whole-final.jpg',[(yard,f'{yard}-whole-before.png',f'{yard}-whole-after.png') for yard in ['aegis','vesper','forge','serein']],500)
sheet('engine-root-variants-close.jpg',[(variants[i]+'|'+variants[i+1],variants[i]+'-close.png',variants[i+1]+'-close.png') for i in [0,2]],600,comparison=False)

sheet('shipyards-controlled.jpg',[(a+'|'+b,a+'-controlled-AFT.png',b+'-controlled-AFT.png') for a,b in [('aegis','vesper'),('forge','serein')]],600,comparison=False)
