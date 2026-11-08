"""Read-only raster inspection; never generates or edits an image."""
from pathlib import Path
from PIL import Image,ImageChops,ImageOps
import hashlib,json
root=Path(__file__).resolve().parents[2]
designs=json.loads((root/'src/graphics/weapon-art/designs.json').read_text())
regions={'impact':(0,12),'body':(12,14),'trail':(14,17),'residue':(17,20),'muzzle':(20,22),'beam':(22,24),'debris':(24,25)}
buckets={k:{} for k in ['all','impactAlpha','phone',*regions]}
perceptual=[]; bounds={}
for d in designs:
 p=root/'public'/d['asset']
 if not p.exists(): continue
 im=Image.open(p).convert('RGBA')
 frames=[]; masks=[]; tiny=[]; tiles=[]
 for i in range(25):
  tile=im.crop((i%5*128,i//5*128,i%5*128+128,i//5*128+128))
  # Normalize luminous color, preserving alpha: recolors alone do not create
  # a new identity. IDs, filenames, names and PNG metadata never enter this.
  box=tile.getchannel('A').getbbox();tiles.append([box[0],box[1],box[2]-box[0],box[3]-box[1]] if box else [0,0,1,1])
  light=tile.convert('L'); alpha=tile.getchannel('A'); raw=ImageOps.autocontrast(ImageChops.multiply(light,alpha)).tobytes();masks.append(alpha.tobytes())
  frames.append(raw)
  if i in [1,3,5,7,9]:
   thumb=tile.resize((16,16)); tl=thumb.convert('L'); ta=thumb.getchannel('A'); vals=[v*a/255 for v,a in zip(tl.getdata(),ta.getdata())]; peak=max(vals) or 1
   tiny.extend(round(v/peak*15) for v in vals)
 bounds[str(d['id'])]=tiles
 for key,region in [('all',(0,25)),*regions.items()]:
  raw=b''.join(frames[region[0]:region[1]]); h=hashlib.sha256(raw).hexdigest();buckets[key].setdefault(h,[]).append(d['name'])
 h=hashlib.sha256(b''.join(masks[:12])).hexdigest();buckets['impactAlpha'].setdefault(h,[]).append(d['name'])
 h=hashlib.sha256(bytes(tiny)).hexdigest();buckets['phone'].setdefault(h,[]).append(d['name'])
 perceptual.append({'id':d['id'],'name':d['name'],'pixels':tiny})
assets={str(d['id']):hashlib.sha256((root/'public'/d['asset']).read_bytes()).hexdigest() for d in designs}
report={k:{'unique':len(v),'duplicates':[names for names in v.values() if len(names)>1]} for k,v in buckets.items()}
Path('/tmp/pocket-owned-frame-bounds.json').write_text(json.dumps(bounds))
Path('/tmp/pocket-owned-audited-assets.json').write_text(json.dumps(assets))
Path('/tmp/pocket-owned-pixel-audit.json').write_text(json.dumps(report,indent=2));Path('/tmp/pocket-owned-perceptual.json').write_text(json.dumps(perceptual))
print(json.dumps(report))
