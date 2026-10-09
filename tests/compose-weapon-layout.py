"""Compose existing WebGL captures; never synthesize or retouch ship geometry."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'qa/v1.8.3/final-review')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
def sheet(name, shots, columns=3, size=600):
    rows=(len(shots)+columns-1)//columns
    canvas=Image.new('RGB',(columns*size,rows*(size+44)), '#13222f')
    d=ImageDraw.Draw(canvas)
    for i,(file,label) in enumerate(shots):
        x=i%columns*size;y=i//columns*(size+44)
        canvas.paste(Image.open(root/f'{file}.png').convert('RGB').resize((size,size)),(x,y+44))
        d.text((x+14,y+12),label,fill='#e9f0f6',font=font)
    canvas.save(root/f'{name}.jpg',quality=94)
sheet('six-views',[(f'complete-{v}',v+' / fixed 360m') for v in ['TOP','BOTTOM','LEFT','RIGHT','ISOMETRIC','LOW-ISOMETRIC']])
sheet('before-after',[(f'{state}-{v}',f'{version} / {v} / 360m') for v in ['TOP','ISOMETRIC','LOW-ISOMETRIC'] for state,version in [('before','V1.8.2'),('complete','V1.8.3')]],2)
sheet('layout-debug',[('layout-TOP','SIZE / TOP'),('layout-BOTTOM','SIZE / BOTTOM'),('symmetry-TOP','SYMMETRY GROUPS'),('sizes-ISOMETRIC','S / M / L: actual scale, 140m'),('arcs-ISOMETRIC','LOCAL FRAMES / ARC SAMPLES, 520m'),('mount-PORT','PORT FOUNDATION, 65m')])
