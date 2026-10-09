"""Compose real WebGL captures; no illustration/image generation."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
root=Path('qa/v1.8.5.2')
source=root/'rendering'
out=root/'images';out.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
def sheet(name,items,cols=2,size=480):
 rows=(len(items)+cols-1)//cols;im=Image.new('RGB',(cols*size,rows*(size+34)), '#111e28');d=ImageDraw.Draw(im)
 for i,(label,path) in enumerate(items):
  p=source/path
  if not p.exists():raise FileNotFoundError(p)
  x=(i%cols)*size;y=(i//cols)*(size+34);img=Image.open(p).convert('RGB').resize((size,size),Image.Resampling.LANCZOS);im.paste(img,(x,y+34));d.text((x+12,y+8),label,font=font,fill='#dce5e8')
 im.save(out/name,quality=91)
sheet('before-after.jpg',[(f'{phase.upper()} / {view}','yard-aegis/'+phase+'-'+view+'.png')for view in ['ISOMETRIC','BOTTOM']for phase in ['before','after']])
sheet('closeups.jpg',[(f'{phase.upper()} / {kind}','yard-aegis/'+phase+'-close-'+kind+'.png')for kind in ['COMMAND','SERVICE_CHANNEL','PROPULSION','WEAPON_PRIMARY']for phase in ['before','after']],2,440)
sheet('shipyards.jpg',[(y.upper()+' / COMMAND','yard-'+y+'/after-close-COMMAND.png')for y in ['aegis','vesper','forge','serein']],2,500)
sheet('shipyard-ships.jpg',[(y.upper(),'yard-'+y+'/after-ISOMETRIC.png')for y in ['aegis','vesper','forge','serein']],2,500)
sheet('families.jpg',[(f,'family-'+f+'/after-ISOMETRIC.png')for f in ['WEDGE_CITADEL','HAMMERHEAD','WIDE_CARRIER','ENGINE_DOMINANT','WEAPON_DOMINANT','SPLIT_FRAME']],3,420)
sheet('lod.jpg',[(m,'yard-aegis/mode-'+m+'.png')for m in ['OFF','LOW','HIGH','AUTO']],2,440)
sheet('lengths.jpg',[(str(n)+' m',('yard-aegis'if n==300 else 'length-'+str(n))+'/after-ISOMETRIC.png')for n in [40,120,300,600]],2,440)
sheet('bridge-window.jpg',[(p.upper()+' / COMMAND WINDOWS','yard-aegis/'+p+'-bridge-window.png')for p in ['before','after']],2,500)
sheet('identification.jpg',[(p.upper()+' / NAVAL ID','yard-aegis/'+p+'-identification-close.png')for p in ['before','after']],2,500)
sheet('texture-armor.jpg',[(y.upper()+' / '+p.upper(),'yard-'+y+'/'+p+'-armor-grain.png')for y in ['aegis','vesper','forge','serein']for p in ['before','after']],2,480)
sheet('environment.jpg',[(p.upper()+' / '+e,'yard-aegis/'+p+'-env-'+e+'.png')for e in ['SPACE','SIDE']for p in ['before','after']],2,500)
sheet('debug.jpg',[(m,'yard-aegis/debug-'+m+'.png')for m in ['TEXTURE','DECAL']],2,500)
sheet('finish.jpg',[(m,'yard-aegis/finish-'+m+'.png')for m in ['CLEAN','SERVICE','WEATHERED']],3,420)
sheet('eight-views.jpg',[(v,'yard-aegis/after-'+v+'.png')for v in ['TOP','BOTTOM','LEFT','RIGHT','FRONT','AFT','ISOMETRIC','LOW-ISOMETRIC']],4,400)
print('14 compact sheets composed from actual WebGL captures.')
