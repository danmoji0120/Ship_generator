"""Compose real WebGL evidence for the three authorized Seed 7 designs only."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path('qa/v1.8.2')
final = root / 'limited-families/final-review'
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
def sheet(items, target, cols, size=480):
    cell = size + 44
    image = Image.new('RGB', (cols * size, ((len(items)+cols-1)//cols)*cell), '#172431')
    draw = ImageDraw.Draw(image)
    for i, (path, label) in enumerate(items):
        pic = Image.open(path).convert('RGB').resize((size, size))
        x, y = (i % cols)*size, (i // cols)*cell
        image.paste(pic, (x, y))
        draw.text((x+12, y+size+10), label, font=font, fill='#e1e9ef')
    image.save(target)

refined = root / 'structural-pilot/refinement-02'
approved = root / 'structural-pilot/review'
views = ['TOP', 'SIDE', 'ISOMETRIC']
sheet([(refined/f'structure-{v}.png', f'SEED 7 refined / {v}') for v in views], refined/'three-views.png', 3, 540)
sheet([(p/f'structure-{v}.png', f'{name} / {v}') for name,p in [('Approved direction',approved),('Refined structure',refined)] for v in views], refined/'approved-vs-refined.png', 3, 500)
families = ['WEDGE_CITADEL','HAMMERHEAD','ENGINE_DOMINANT']
sheet([(final/f/f'structure-{v}.png', f'{f} / {v}') for f in families for v in views], final/'family-three-views.png', 3, 500)
sheet([(final/f/f'{stage}-ISOMETRIC.png',f'{f} / {label}') for f in families for stage,label in [('structure','Structure only'),('mounted','Mounts on same structure')]], final/'mount-comparison.png', 2, 600)
for f in families:
    sheet([(final/f/f'{stage}-{v}.png',f'{label} / {v}') for stage,label in [('baseline','V1.8.1 panel-free'),('structure','Structural refinement')] for v in views], final/f/'before-after.png', 3, 480)
print('PASS: composed seven sheets from existing real WebGL PNGs; no new designs generated.')
