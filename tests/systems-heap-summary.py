import json,re,sys,collections
path=sys.argv[1];counts=collections.Counter();sizes=collections.Counter();largest=[]
with open(path) as f:
 prefix=''
 while '"nodes":[' not in prefix:
  prefix+=f.read(65536)
 header,tail=prefix.split('"nodes":[',1);meta=json.loads(header+'"nodes":[]}')['snapshot']['meta'];fields=meta['node_fields'];types=meta['node_types'][0];stride=len(fields);at=fields.index('self_size');idat=fields.index('id');nameat=fields.index('name');record=[];carry='';done=False
 while not done:
  chunk=carry+tail;tail=f.read(1048576);end=chunk.find(']')
  if end>=0:chunk=chunk[:end];done=True
  elif tail:
   m=re.search(r'\d+$',chunk);carry=m.group(0) if m else '';chunk=chunk[:-len(carry)] if carry else chunk
  else:done=True
  for n in re.findall(r'\d+',chunk):
   record.append(int(n))
   if len(record)==stride:
    typ=types[record[0]];size=record[at];counts[typ]+=1;sizes[typ]+=size
    if size>1048576:largest.append({'type':typ,'selfBytes':size,'heapObjectId':record[idat],'nameStringIndex':record[nameat]})
    record=[]
json.dump({'method':'Post-GC Chrome heap snapshot node table, self sizes only, not transitive retained sizes. Raw dump excluded from Git. Allocation sampling separately locates source owners.','counts':dict(counts),'selfBytes':dict(sizes),'largest':sorted(largest,key=lambda x:-x['selfBytes'])[:25]},open(sys.argv[2],'w'),indent=2)
