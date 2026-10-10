from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
root=Path('qa/v1.8.5.4.1');font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
for name,views in [('layout',[('Hardpoints','top'),('Hardpoints','iso'),('Hardpoint-Layout-Only','top')]),('normal',[('Normal','top'),('Normal','iso')])]:
 out=Image.new('RGB',(1440,490*len(views)),(17,28,39));d=ImageDraw.Draw(out)
 for i,(mode,view) in enumerate(views):
  for j,stage in enumerate(['before','after']):
   p=root/f'{stage}-{mode}-{view}.png'
   if not p.exists():continue
   im=Image.open(p).convert('RGB').resize((720,465));out.paste(im,(j*720,i*490+25));d.text((j*720+12,i*490+2),f'{stage.upper()}  {mode} / {view.upper()}',font=font,fill='white')
 out.save(root/f'{name}-comparison.jpg',quality=91)
