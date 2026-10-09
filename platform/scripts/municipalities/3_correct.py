"""Owner, 9 October 2026: 'Fix them according to google, and as long as the main ones are there, go ahead.'
Applied over the cleaned governorate files (muni-built.json). Every change is recorded."""
import json, sys, collections
b = json.load(open(sys.argv[1]))
out = b['municipalities']
log = [{'from': a, 'to': c} for a, c in b['fixed']] + [{'from': s[1].strip('‫‬'), 'to': 'left out -- Arabic only, no English name (' + s[2] + ')'} for s in b['skipped']]
# Undo the duplicate suffixes; they are recomputed with the corrected district names.
for m in out:
    if m['en'].endswith(f" ({m['districtEn']})"): m['en'] = m['en'][: -len(f" ({m['districtEn']})")]
DISTRICT = {'Aakkar': 'Akkar', 'Aalay': 'Aley', 'Kesrouane': 'Keserwan', 'Nabatiyeh': 'Nabatieh', 'Hasbaiyya': 'Hasbaya', 'Rachaiya': 'Rashaya',
            'Sour': 'Tyre', 'Byblos': 'Jbeil', 'El Chouf': 'Chouf', 'Western Bekaa': 'West Bekaa', 'Minieh - Danniyeh': 'Minieh-Danniyeh'}
for m in out:
    if m['districtEn'] in DISTRICT: m['districtEn'] = DISTRICT[m['districtEn']]
log.append({'from': 'district names as the files spell them (' + ', '.join(DISTRICT) + ')', 'to': 'their common spellings (' + ', '.join(DISTRICT.values()) + ')'})
# (name, district) -> (new name, aliases kept searchable)
RENAME = {
    ('Zahl', 'Zahle'): ('Zahle', ['Zahleh', 'Zahl']),
    ('ta Zahl', 'Jezzine'): ('Zahlta', []),
    ('Sidon', 'Jezzine'): ('Saydoun', []),
    ('Sidon', 'Saida'): ('Saida', ['Sidon']),
    ('Bkassine and its dependencies', 'Jezzine'): ('Bkassine', []),
    ('Al Batroun', 'Batroun'): ('Batroun', ['Al Batroun']),
    ('Al Hermel', 'Hermel'): ('Hermel', ['Al Hermel']),
    ('Al-Mina', 'Tripoli'): ('El Mina', ['Al-Mina', 'Mina']),
    ('Sour', 'Tyre'): ('Tyre', ['Sour']),
    ('Jbeil', 'Jbeil'): ('Byblos (Jbeil)', ['Jbeil', 'Byblos']),
    ('Bsharri', 'Bcharre'): ('Bcharre', ['Bsharri', 'Becharre']),
    ('Amyoun', 'Koura'): ('Amioun', ['Amyoun']),
    ('Al-Minya', 'Minieh-Danniyeh'): ('Minieh', ['Al-Minya', 'Miniyeh']),
    ('Burj al-Barajneh', 'Baabda'): ('Bourj el Barajneh', ['Burj al-Barajneh']),
    ('Broumana', 'Matn'): ('Broummana', ['Broumana']),
    ('Beit Meri', 'Matn'): ('Beit Mery', ['Beit Meri']),
    ('Qubayyat', 'Akkar'): ('Qobayat', ['Qubayyat', 'Kobayat']),
    ('Al-Laboue', 'Baalbek'): ('Labweh', ['Al-Laboue']),
    ('Kamid Al-Lawz', 'West Bekaa'): ('Kamed el Loz', ['Kamid Al-Lawz']),
    ('Mashgharah', 'West Bekaa'): ('Machghara', ['Mashgharah']),
    ('Qob Elias - Wadi El-Dleim', 'Zahle'): ('Qab Elias - Wadi El Delm', ['Qob Elias', 'Qab Elias']),
    ('Rashaya', 'Rashaya'): ('Rashaya', ['Rachaya']),
    ('Zgharta-Ehden', 'Zgharta'): ('Zgharta-Ehden', ['Zgharta', 'Ehden']),
    ('Jezzine - Ain Majdeline', 'Jezzine'): ('Jezzine - Ain Majdeline', ['Jezzine']),
}
done = set()
for m in out:
    k = (m['en'], m['districtEn'])
    if k in RENAME:
        new, aliases = RENAME[k]
        if new != m['en']: log.append({'from': f"{m['en']} ({m['districtEn']})", 'to': new})
        m['en'] = new
        if aliases: m['aliases'] = aliases
        done.add(k)
missing = set(RENAME) - done
assert not missing, missing
GOVERNORATE = {'Aley': 'Mount Lebanon', 'Baabda': 'Mount Lebanon', 'Chouf': 'Mount Lebanon', 'Matn': 'Mount Lebanon', 'Keserwan': 'Mount Lebanon',
               'Zahle': 'Bekaa', 'West Bekaa': 'Bekaa', 'Batroun': 'North', 'Marjayoun': 'Nabatieh', 'Saida': 'South', 'Baalbek': 'Baalbek-Hermel'}
ADD = [
    ('Aley', 'Aley', []), ('Choueifat', 'Aley', ['Shwayfat', 'Khaldeh']), ('Kahaleh', 'Aley', []), ('Bchamoun', 'Aley', []),
    ('Baabda', 'Baabda', []), ('Hadath', 'Baabda', []), ('Kfarchima', 'Baabda', []),
    ('Deir el Qamar', 'Chouf', []), ('Beiteddine', 'Chouf', []), ('Damour', 'Chouf', []), ('Chhim', 'Chouf', []), ('Kfarhim', 'Chouf', []),
    ('Jdeideh-Bouchrieh-Sed', 'Matn', ['Jdeideh', 'Bouchrieh']), ('Roumieh', 'Matn', []), ('Mtein', 'Matn', []), ('Dhour Choueir', 'Matn', []),
    ('Zouk Mikael', 'Keserwan', []), ('Harissa-Daraoun', 'Keserwan', ['Harissa']),
    ('Chtaura', 'Zahle', ['Shtaura']), ('Rayak', 'Zahle', ['Riyaq']), ('Anjar', 'Zahle', ['Aanjar']),
    ('Joub Jannine', 'West Bekaa', []), ('Sohmor', 'West Bekaa', []),
    ('Chekka', 'Batroun', []),
    ('Jdeidet Marjayoun', 'Marjayoun', ['Marjayoun']), ('Khiam', 'Marjayoun', ['Khiyam']), ('Kfar Kila', 'Marjayoun', []),
    ('Maghdouche', 'Saida', []),
    ('Arsal', 'Baalbek', []), ('Ras Baalbek', 'Baalbek', []), ('Al Qaa', 'Baalbek', ['Qaa']),
]
have = {(m['en'], m['districtEn']) for m in out}
for name, dist, aliases in ADD:
    assert (name, dist) not in have, name
    m = {'en': name, 'districtEn': dist, 'governorateEn': GOVERNORATE[dist], 'added': True}
    if aliases: m['aliases'] = aliases
    out.append(m)
    log.append({'from': '(none)', 'to': f'{name} ({dist}) -- added; a main municipality the files lack'})
for m in out:
    if m.get('governorateEn') is None: m['governorateEn'] = ''
count = collections.Counter(m['en'] for m in out)
for m in out:
    if count[m['en']] > 1: m['en'] = f"{m['en']} ({m['districtEn']})"
assert len({m['en'] for m in out}) == len(out)
out.sort(key=lambda m: m['en'].lower())
json.dump({'municipalities': out, 'corrections': log}, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
print(len(out), 'municipalities;', len(log), 'corrections;', sum(1 for m in out if m.get('added')), 'added')
