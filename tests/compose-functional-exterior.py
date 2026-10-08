"""Layout real WebGL captures; no ship pixels, projection or lighting edits."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import os

root = Path(os.environ.get('FUNCTIONAL_OUTPUT', 'qa/v1.8.2/functional-exterior/final-review'))
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
views = ['TOP', 'SIDE', 'ISOMETRIC', 'BOTTOM', 'LOW-ISOMETRIC']

def layout(items, columns, name, cell=600):
    rows = (len(items)+columns-1)//columns
    canvas = Image.new('RGB', (columns*cell, rows*(cell+45)), '#172431')
    draw = ImageDraw.Draw(canvas)
    for i, (file, label) in enumerate(items):
        x, y = i%columns*cell, i//columns*(cell+45)
        canvas.paste(Image.open(root/(file+'.png')).convert('RGB').resize((cell,cell)), (x,y))
        draw.text((x+10,y+cell+10),label,font=font,fill='#e2e9ef')
    canvas.save(root/name)

layout([(f'complete-{v}',f'Seed 7 / Complete / {v}') for v in views],3,'five-views.png')
layout([(f'{s}-{v}',f'{label} / {v}') for s,label in [('before','Approved baseline'),('complete','Functional integration')] for v in ['TOP','SIDE','ISOMETRIC']],3,'before-after.png')
layout([(f'{s}-{v}',f'{label} / {v}') for s,label in [('before-neutral','Baseline / neutral'),('neutral','Integration / neutral')] for v in ['TOP','SIDE','ISOMETRIC']],3,'neutral-before-after.png')
layout([(f'{s}-{v}',f'{label} / {v}') for s,label in [('before','Approved baseline'),('complete','Functional integration')] for v in ['BOTTOM','LOW-ISOMETRIC']],2,'underbody-before-after.png')
layout([(name,name.replace('-',' ')) for name in ['weapon-closeup','command-closeup','maintenance-closeup','drive-closeup','ventral-pocket-closeup']],3,'functional-closeups.png',450)
layout([('complete-no-hardpoints','Same armor / installations hidden'),('complete-ISOMETRIC','Same armor / installations mounted')],2,'hardpoint-comparison.png')
print('Composed six review sheets from actual WebGL captures.')
