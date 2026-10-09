import json, re, sys, collections
rows = json.load(open(sys.argv[1]))
rev = lambda s: ' '.join(reversed(s.split()))
GOV = {'North': ('North', 'الشمال'), 'Akkar': ('Akkar', 'عكار'), 'Baalbeck-Hermel': ('Baalbek-Hermel', 'بعلبك الهرمل'), 'Beqaa': ('Bekaa', 'البقاع'),
       'Mount_Lebanon': ('Mount Lebanon', 'جبل لبنان'), 'Saida': ('South', 'الجنوب'), 'Nabatieh': ('Nabatieh', 'النبطية')}
out, skipped, fixed = [], [], []
for gov, name, dist in rows:
    if re.search('[؀-ۿ]', name):
        skipped.append((gov, name, dist, 'Arabic only, no English name')); continue
    if name.startswith('district Baabda the in located Arsoun'):
        fixed.append((name, 'Arsoun')); name_en = 'Arsoun'
    elif name.startswith('Nahr El Tahwitet - Remmaneh El Ain - Chebbak El'):
        name_en = rev(name + ' Furn'); fixed.append((name + ' + Furn', name_en))
    else:
        name_en = rev(name)
    out.append({'en': name_en, 'districtEn': rev(dist), 'governorateEn': GOV[gov][0]})
# A row listed twice (same name, same district) is one municipality.
seen=set(); uniq=[]
for m in out:
    k=(m['en'],m['districtEn'])
    if k in seen: fixed.append((m['en']+' / '+m['districtEn'], 'listed twice; kept once')); continue
    seen.add(k); uniq.append(m)
out=uniq
# Beirut is one municipality and none of the governorate files covers it.
out.append({'en': 'Beirut', 'districtEn': 'Beirut', 'governorateEn': 'Beirut'})
# Two places of the same name in different districts are told apart by the district.
count = collections.Counter(m['en'] for m in out)
for m in out:
    if count[m['en']] > 1: m['en'] = f"{m['en']} ({m['districtEn']})"
dups = [k for k, v in collections.Counter(m['en'] for m in out).items() if v > 1]
out.sort(key=lambda m: m['en'].lower())
json.dump({'municipalities': out, 'skipped': skipped, 'fixed': fixed, 'stillDuplicate': dups}, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
print(len(out), 'skipped', skipped, 'fixed', fixed, 'dups', dups)
print(sorted(set(m['districtEn'] for m in out)))
print([m['en'] for m in out if ' ' in m['en']][:40])
