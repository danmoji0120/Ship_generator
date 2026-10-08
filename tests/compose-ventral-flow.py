"""Arrange captured WebGL PNGs only; never alter ship geometry or lighting."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path('qa/v1.8.2/ventral-flow')
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
views = ['BOTTOM', 'LOW-ISOMETRIC', 'SIDE']

def sheet(folder, rows, name, camera_views=views):
    canvas = Image.new('RGB', (len(camera_views)*600, len(rows)*645), '#172431')
    draw = ImageDraw.Draw(canvas)
    for row, (subdir, stage, label) in enumerate(rows):
        for col, view in enumerate(camera_views):
            path = folder/subdir/f'{stage}-{view}.png'
            canvas.paste(Image.open(path).convert('RGB').resize((600,600)), (col*600,row*645))
            draw.text((col*600+10,row*645+609), f'{label} / {view}',font=font,fill='#e2e9ef')
    canvas.save(folder/name)

seed = root/'seed7-final'
sheet(seed, [('', 'structure', 'Seed 7 / no panels or mounts')], 'three-views.png')
sheet(seed, [('', 'before', 'Approved initial belly'), ('', 'structure', 'Refined flow / same frame')], 'before-after.png')
limited = root/'three-family-review'
families = ['WEDGE_CITADEL', 'HAMMERHEAD', 'ENGINE_DOMINANT']
sheet(limited, [(fam,'structure',fam) for fam in families], 'family-three-views.png')
sheet(limited, [(fam,'structure',fam) for fam in families], 'upper-lower-overview.png', ['TOP','ISOMETRIC'])
for fam in families:
    sheet(limited/fam, [('', 'before','Reviewed upper / before lower'), ('','structure','Lower applied / no mounts')], 'before-after.png')
print('Composed fixed-frame seed and three-family review sheets.')
