"""Compose actual Chromium captures; never substitute generated art for render evidence."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path('qa/v1.8.5.3');out=root/'review';out.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
def sheet(name,items,columns=2,size=430):
 rows=(len(items)+columns-1)//columns;canvas=Image.new('RGB',(columns*size,rows*(size+34)),(16,25,35));d=ImageDraw.Draw(canvas)
 for i,(label,path) in enumerate(items):
  im=Image.open(path).convert('RGB');im.thumbnail((size,size));x=(i%columns)*size;y=(i//columns)*(size+34);canvas.paste(im,(x+(size-im.width)//2,y+34));d.text((x+12,y+9),label,fill=(222,232,244),font=font)
 canvas.save(out/name)
matrix=root/'matrix-release';final=root/'release-render'
sheet('shipyard-comparison.jpg',[(yard+' / '+view,matrix/f'yard-{yard}-{view}.png')for yard in ['aegis','vesper','forge','serein']for view in ['ISOMETRIC','BOTTOM']])
architectures=['MONOLITHIC','BLOCK_ASSEMBLY','SPINE_AND_MODULES','TRUSS_POD','TWIN_HULL','CORE_AND_NACELLES','STACKED_BLOCKS','HYBRID']
sheet('architecture-comparison.jpg',[(arch,matrix/f'architecture-{arch}-ISOMETRIC.png')for arch in architectures],4,400)
family_arch=[('WEDGE_CITADEL','MONOLITHIC'),('HAMMERHEAD','BLOCK_ASSEMBLY'),('WEAPON_DOMINANT','SPINE_AND_MODULES'),('SPLIT_FRAME','TRUSS_POD'),('WIDE_CARRIER','TWIN_HULL'),('ENGINE_DOMINANT','CORE_AND_NACELLES')]
sheet('family-comparison.jpg',[(family,matrix/f'architecture-{arch}-ISOMETRIC.png')for family,arch in family_arch],3,460)
sheet('length-comparison.jpg',[(str(length)+'m / '+view,matrix/f'length-{length}-{view}.png')for length in [40,120,300,600]for view in ['ISOMETRIC','BOTTOM']])
if(final/'report.json').exists():
 for view in ['TOP','BOTTOM','LEFT','RIGHT','FRONT','AFT','ISOMETRIC','LOW-ISOMETRIC']:
  sheet('before-after-'+view+'.jpg',[(label.upper()+' / '+view,final/f'{label}-{view}.png')for label in ['before','after']],2,650)
 close=[p.name[len('after-close-'):-4]for p in final.glob('after-close-*.png')]
 sheet('closeups.jpg',[(label.upper()+' / '+name,final/f'{label}-close-{name}.png')for name in close for label in ['before','after']],2,550)
 sheet('detail-modes.jpg',[(mode,final/f'detail-{mode}.png')for mode in ['OFF','LOW','HIGH','AUTO']],2,500)
print(out.resolve())
