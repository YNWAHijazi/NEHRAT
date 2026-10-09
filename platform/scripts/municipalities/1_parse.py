import sys, re, glob, json, collections
rows=[]
for f in sorted(glob.glob(sys.argv[1]+'/*.txt')):
    gov=re.sub(r'^[0-9a-f]+-','',f.split('/')[-1][:-4])
    for line in open(f,encoding='utf8'):
        line=line.rstrip()
        if not line.strip() or 'Municipalities' in line: continue
        parts=re.split(r'\s{3,}', line.strip())
        if len(parts)!=2: print('ODD',gov,repr(line)); continue
        rows.append((gov,parts[0],parts[1]))
json.dump(rows,open(sys.argv[2],'w'),ensure_ascii=False)
c=collections.Counter(); d=collections.defaultdict(collections.Counter)
for g,n,dist in rows: c[g]+=1; d[g][dist]+=1
for g in c: print(g,c[g],dict(d[g]))
print('total',len(rows))
multi=[n for _,n,_ in rows if ' ' in n]
print('multiword',len(multi))
first=collections.Counter(n.split()[0] for n in multi); last=collections.Counter(n.split()[-1] for n in multi)
print('FIRST',first.most_common(25)); print('LAST',last.most_common(25))
