"""Keep exhaustive decisions in compressed blueprints; keep the index small and readable."""
from pathlib import Path
import json,gzip,collections
D=Path('qa/v1.8.1')
r=json.load(open(D/'report.json'))
for row in r['records']:
 decisions=row.pop('decisions',None)
 if decisions is not None:row['decisionSummary']=dict(collections.Counter(d.get('reason','accepted') for d in decisions));row['decisionsInBlueprint']=f'blueprints/{row["yard"]}-{row["architecture"]}-{row["seed"]}.json.gz'
json.dump(r,open(D/'report.json','w'),indent=2)
# Compress ONLY newly generated artifacts. All historical qa/v1.8 data stays untouched.
for folder in ['initial','before-after','failures']:
 for path in (D/folder).rglob('*.json'):
  if path.stat().st_size>1_000_000:
   with open(path,'rb')as src,gzip.open(str(path)+'.gz','wb',compresslevel=9)as dst:dst.write(src.read())
   path.unlink()
