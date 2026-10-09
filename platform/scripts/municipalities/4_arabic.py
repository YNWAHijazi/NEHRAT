"""Adds the Arabic names to lib/rules/data/municipalities.json (owner, 9 October 2026: "Can't you just
translate them"). The municipality names were drafted from the English transliterations, one
governorate at a time (out-<Governorate>.json: {en: {ar, sure}}); district and governorate names are
the standard ones. Every entry drafted with doubt carries arUnsure: true for the Ministry's check.
Usage: python3 -I 4_arabic.py <folder with out-*.json> <municipalities.json>"""
import json, sys, glob
DISTRICT_AR = {
    'Akkar': 'عكار', 'Aley': 'عاليه', 'Baabda': 'بعبدا', 'Baalbek': 'بعلبك', 'Batroun': 'البترون', 'Bcharre': 'بشري', 'Beirut': 'بيروت',
    'Bint Jbeil': 'بنت جبيل', 'Chouf': 'الشوف', 'Hasbaya': 'حاصبيا', 'Hermel': 'الهرمل', 'Jbeil': 'جبيل', 'Jezzine': 'جزين', 'Keserwan': 'كسروان',
    'Koura': 'الكورة', 'Marjayoun': 'مرجعيون', 'Matn': 'المتن', 'Minieh-Danniyeh': 'المنية - الضنية', 'Nabatieh': 'النبطية', 'Rashaya': 'راشيا',
    'Saida': 'صيدا', 'Tripoli': 'طرابلس', 'Tyre': 'صور', 'West Bekaa': 'البقاع الغربي', 'Zahle': 'زحلة', 'Zgharta': 'زغرتا',
}
GOVERNORATE_AR = {'North': 'الشمال', 'Akkar': 'عكار', 'Baalbek-Hermel': 'بعلبك - الهرمل', 'Bekaa': 'البقاع', 'Mount Lebanon': 'جبل لبنان',
                  'South': 'الجنوب', 'Nabatieh': 'النبطية', 'Beirut': 'بيروت'}
drafts = {'Beirut': {'ar': 'بيروت', 'sure': True}}
# Names a correction introduced after the drafts were made.
EXTRA = {'Tannoura': {'ar': 'تنورة', 'sure': False}}
for f in glob.glob(sys.argv[1] + '/out-*.json'):
    drafts.update(json.load(open(f)))
path = sys.argv[2]
data = json.load(open(path))
missing = []
def bare_of(m):
    return m['en'][: -len(f" ({m['districtEn']})")] if m['en'].endswith(f" ({m['districtEn']})") else m['en']
# A bracket that tells two same-named places apart, not a name that happens to end in its district ('Byblos (Jbeil)').
import collections
shared = collections.Counter(bare_of(m) for m in data['municipalities'])
for m in data['municipalities']:
    # A name drafted with or without its district bracket, or under the name it had before a correction.
    bare = m['en'][: -len(f" ({m['districtEn']})")] if m['en'].endswith(f" ({m['districtEn']})") else m['en']
    d = drafts.get(m['en']) or drafts.get(bare) or drafts.get(f"{bare} ({m['districtEn']})") or EXTRA.get(bare)
    if not d or not d.get('ar', '').strip():
        missing.append(m['en']); continue
    m['ar'] = d['ar'].strip()
    if not d.get('sure', True): m['arUnsure'] = True
    else: m.pop('arUnsure', None)
    m['districtAr'] = DISTRICT_AR[m['districtEn']]
    # Two places of the same name carry their district in brackets, in Arabic as in English.
    if m['en'].endswith(f" ({m['districtEn']})") and shared[bare] > 1: m['ar'] = f"{m['ar']} ({m['districtAr']})"

    m['governorateAr'] = GOVERNORATE_AR[m['governorateEn'] or 'Beirut']
    if not m['governorateEn']: m['governorateEn'] = 'Beirut'
assert not missing, missing
data.pop('arabicPending', None)
data['arabicSource'] = ('Drafted on 9 October 2026 from the English names, at the owner\'s request ("Can\'t you just translate them"): '
                        'municipality names by their standard Lebanese spelling, district and governorate names as officially written. '
                        'NOT the Ministry of Interior\'s list: entries marked arUnsure were drafted with doubt; all should be checked against the official list when it is available.')
json.dump(data, open(path, 'w'), ensure_ascii=False, indent=1)
print(len(data['municipalities']), 'with Arabic;', sum(1 for m in data['municipalities'] if m.get('arUnsure')), 'marked unsure')
