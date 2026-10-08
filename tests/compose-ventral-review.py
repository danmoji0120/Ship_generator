from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

root=Path('qa/v1.8.2/structural-pilot/ventral/final-review')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19)
views=['BOTTOM','LOW-ISOMETRIC','SIDE']
for rows,name in [([('structure','Panels & mounts hidden')],'three-views.png'),([('before','Before / same frame'),('structure','After / panels & mounts hidden')],'before-after.png')]:
    canvas=Image.new('RGB',(1800,len(rows)*645),'#172431')
    draw=ImageDraw.Draw(canvas)
    for row,(stage,label) in enumerate(rows):
        for col,view in enumerate(views):
            pic=Image.open(root/f'{stage}-{view}.png').convert('RGB').resize((600,600))
            canvas.paste(pic,(col*600,row*645))
            draw.text((col*600+10,row*645+609),view+' / '+label,font=font,fill='#e2e9ef')
    canvas.save(root/name)
print('Composed two sheets from the real fixed-scale WebGL PNGs.')
