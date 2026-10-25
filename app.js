// Kaal for the web: the iOS app's screens over the same engine (kaal_wasm),
// the same content packs and the same interface text. Everything is
// unlocked here; settings and profiles stay in this browser.
import { engine, onRestart } from './engine.js?v=202610242022';
// The build stamp, also put on data files so a new page never reads old data.
const V = (import.meta.url.match(/v=(\d+)/) || [])[1] || 'dev';

const CULTURES = [
  { id: 'malayalam', en: 'Malayalam', native: 'മലയാളം' },
  { id: 'tamil', en: 'Tamil', native: 'தமிழ்' },
  { id: 'telugu', en: 'Telugu', native: 'తెలుగు' },
  { id: 'kannada', en: 'Kannada', native: 'ಕನ್ನಡ' },
  { id: 'north-indian', en: 'North Indian', native: 'उत्तर भारतीय' },
  { id: 'gujarati', en: 'Gujarati', native: 'ગુજરાતી' },
  { id: 'marathi', en: 'Marathi', native: 'मराठी' },
  { id: 'bengali', en: 'Bengali', native: 'বাংলা' },
  { id: 'odia', en: 'Odia', native: 'ଓଡ଼ିଆ' },
  { id: 'nepali', en: 'Nepali', native: 'नेपाली' },
  { id: 'sri-lankan-tamil', en: 'Sri Lankan Tamil', native: 'இலங்கைத் தமிழ்' },
  { id: 'malaysian-tamil', en: 'Malaysian & Singapore Tamil', native: 'மலேசிய, சிங்கப்பூர் தமிழ்' },
  { id: 'south-african-tamil', en: 'South African Tamil', native: 'தென்னாப்பிரிக்கத் தமிழ்' },
  { id: 'caribbean', en: 'Caribbean', native: 'कैरिबियाई' },
  { id: 'fijian', en: 'Fiji', native: 'फ़िजी' },
  { id: 'mauritian', en: 'Mauritius', native: 'मॉरीशस' },
];
const LIGHT = ['kaal', 'ivory', 'rose', 'sage'], DARK = ['kaal-dark', 'night', 'charcoal', 'peacock'];
const TABS = [['home', 'hm.home'], ['today', 'tab.today'], ['calendar', 'tab.calendar'], ['festivals', 'tab.festivals'], ['muhurtham', 'tab.muhurtham'],
  ['birthstar', 'bs.title'], ['vrats', 'v.title'], ['jathakam', 'jk.title'], ['match', 'mt.label'], ['greetings', 'gr.title'], ['guide', 'gd.title'], ['sky', 'sk.title'], ['temples', 'tm.title'], ['prayers', 'py.title'], ['oldtime', 'ot.title'], ['people', 'pp.title'], ['settings', 'tab.settings']];

// ---------------------------------------------------------------- state
const saved = (() => { try { return JSON.parse(localStorage.getItem('kaal-web') || '{}'); } catch { return {}; } })();
const S = Object.assign({ tileOrder: [], tileStyle: 'classic', textSize: 1, culture: '', native: false, home: null, theme: 'system', light: 'kaal', dark: 'kaal-dark', people: [], vrats: [], vratLog: {}, families: [] }, saved);
function save() { try { localStorage.setItem('kaal-web', JSON.stringify(S)); } catch {} }
// The app's text size, 0 (smaller) to 4 (largest), as on iOS: the whole page scales.
const SHARE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
const TEXT_SIZES = [0.9, 1, 1.15, 1.3, 1.45];
const applyTextSize = () => { document.documentElement.style.setProperty('--ts', TEXT_SIZES[S.textSize] ?? 1); document.body.style.zoom = TEXT_SIZES[S.textSize] ?? 1; };

let STR = {}, pack = null, packJson = '', tab = 'home', dayDate = null, monthDate = null;
const handles = new Map();
onRestart(() => handles.clear());
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- text
const lang = () => (S.native && pack ? pack.language : 'en');
function t(key, ...args) { return tIn(lang(), key, ...args); }
// The same in a given language: a matching reading can be read in any of them.
function tIn(L, key, ...args) {
  const e = STR[key];
  let s = e ? (e[L] ?? e.en) : key;
  // English in the tradition's own vocabulary ("Muhurtham" -> "Shubh Muhurat").
  if (L === 'en') for (const [a, b] of pack?.display?.terms || []) s = s.split(a).join(b);
  let i = 0;
  return s.replace(/%(?:(\d+)\$)?([@d])/g, (_, n) => String(args[n ? Number(n) - 1 : i++] ?? '')).replace(/%%/g, '%');
}
const name = (table, key) => { const e = pack?.names?.[table]?.[key]; return e ? (e[lang()] ?? e.en) : (key || ''); };
// In English, the name used where the user lives: Phagwah in Trinidad, Thaipoosam Cavadee in Mauritius.
const fname = f => (lang() === 'en' && f.localNames?.[S.home?.country]) || (f.names[lang()] ?? f.names.en);
// A public holiday where the user lives: by country, or by state ("IN-TN", "MY-14").
function isHoliday(f) {
  const c = S.home?.country, st = pack?.regions?.[c]?.[S.home?.region];
  return (f.holidayIn || []).some(x => x === c || (st && x === `${c}-${st}`));
}
// The lunar date a festival is kept on, when its tithi begins after sunrise in the same paksha.
function keptLunar(f, l) {
  const t = f.rule?.type === 'tithi-in-lunar-month' ? f.rule.tithi : null;
  return l && t && t !== l.tithi && (t > 15) === (l.tithi > 15) ? { ...l, tithi: t } : l;
}
const fother = f => { const o = lang() === 'en' ? pack.language : 'en'; const n = f.names[o]; return n && n !== fname(f) ? n : ''; };
const recName = key => { const r = pack.dailySignificance.find(d => d.key === key); return r ? (r.names[lang()] ?? r.names.en ?? key) : key; };
const text = d => d ? (d[lang()] ?? d.en) : '';
const locale = () => (lang() === 'en' ? 'en-IN' : `${lang()}-IN`);

// ---------------------------------------------------------------- dates
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
function today(tz = S.home?.tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
// The calendar can be looked at for another city without changing home:
// monthPlace for the month grid, dayPlace for a day opened from it.
let monthPlace = null, dayPlace = null;
const here = () => dayPlace || S.home;
// Month and weekday names by language (from ICU). Browsers carry little or no date data for some
// languages (Odia, Nepali), and fall back to English or "2026 M10 23"; Kaal fills in the names itself.
const DATE_NAMES = {"ml": {"ml": ["ജനുവരി", "ഫെബ്രുവരി", "മാർച്ച്", "ഏപ്രിൽ", "മേയ്", "ജൂൺ", "ജൂലൈ", "ഓഗസ്റ്റ്", "സെപ്റ്റംബർ", "ഒക്‌ടോബർ", "നവംബർ", "ഡിസംബർ"], "ms": ["ജനു", "ഫെബ്രു", "മാർ", "ഏപ്രി", "മേയ്", "ജൂൺ", "ജൂലൈ", "ഓഗ", "സെപ്റ്റം", "ഒക്ടോ", "നവം", "ഡിസം"], "wl": ["ഞായറാഴ്‌ച", "തിങ്കളാഴ്‌ച", "ചൊവ്വാഴ്‌ച", "ബുധനാഴ്‌ച", "വ്യാഴാഴ്‌ച", "വെള്ളിയാഴ്‌ച", "ശനിയാഴ്‌ച"], "ws": ["ഞായർ", "തിങ്കൾ", "ചൊവ്വ", "ബുധൻ", "വ്യാഴം", "വെള്ളി", "ശനി"]}, "ta": {"ml": ["ஜனவரி", "பிப்ரவரி", "மார்ச்", "ஏப்ரல்", "மே", "ஜூன்", "ஜூலை", "ஆகஸ்ட்", "செப்டம்பர்", "அக்டோபர்", "நவம்பர்", "டிசம்பர்"], "ms": ["ஜன.", "பிப்.", "மார்.", "ஏப்.", "மே", "ஜூன்", "ஜூலை", "ஆக.", "செப்.", "அக்.", "நவ.", "டிச."], "wl": ["ஞாயிறு", "திங்கள்", "செவ்வாய்", "புதன்", "வியாழன்", "வெள்ளி", "சனி"], "ws": ["ஞாயி.", "திங்.", "செவ்.", "புத.", "வியா.", "வெள்.", "சனி"]}, "hi": {"ml": ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्तूबर", "नवंबर", "दिसंबर"], "ms": ["जन॰", "फ़र॰", "मार्च", "अप्रैल", "मई", "जून", "जुल॰", "अग॰", "सित॰", "अक्तू॰", "नव॰", "दिस॰"], "wl": ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"], "ws": ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"]}, "te": {"ml": ["జనవరి", "ఫిబ్రవరి", "మార్చి", "ఏప్రిల్", "మే", "జూన్", "జులై", "ఆగస్టు", "సెప్టెంబర్", "అక్టోబర్", "నవంబర్", "డిసెంబర్"], "ms": ["జన", "ఫిబ్ర", "మార్చి", "ఏప్రి", "మే", "జూన్", "జులై", "ఆగ", "సెప్టెం", "అక్టో", "నవం", "డిసెం"], "wl": ["ఆదివారం", "సోమవారం", "మంగళవారం", "బుధవారం", "గురువారం", "శుక్రవారం", "శనివారం"], "ws": ["ఆది", "సోమ", "మంగళ", "బుధ", "గురు", "శుక్ర", "శని"]}, "kn": {"ml": ["ಜನವರಿ", "ಫೆಬ್ರವರಿ", "ಮಾರ್ಚ್", "ಏಪ್ರಿಲ್", "ಮೇ", "ಜೂನ್", "ಜುಲೈ", "ಆಗಸ್ಟ್", "ಸೆಪ್ಟೆಂಬರ್", "ಅಕ್ಟೋಬರ್", "ನವೆಂಬರ್", "ಡಿಸೆಂಬರ್"], "ms": ["ಜನ", "ಫೆಬ್ರ", "ಮಾರ್ಚ್", "ಏಪ್ರಿ", "ಮೇ", "ಜೂನ್", "ಜುಲೈ", "ಆಗ", "ಸೆಪ್ಟೆಂ", "ಅಕ್ಟೋ", "ನವೆಂ", "ಡಿಸೆಂ"], "wl": ["ಭಾನುವಾರ", "ಸೋಮವಾರ", "ಮಂಗಳವಾರ", "ಬುಧವಾರ", "ಗುರುವಾರ", "ಶುಕ್ರವಾರ", "ಶನಿವಾರ"], "ws": ["ಭಾನು", "ಸೋಮ", "ಮಂಗಳ", "ಬುಧ", "ಗುರು", "ಶುಕ್ರ", "ಶನಿ"]}, "gu": {"ml": ["જાન્યુઆરી", "ફેબ્રુઆરી", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઑગસ્ટ", "સપ્ટેમ્બર", "ઑક્ટોબર", "નવેમ્બર", "ડિસેમ્બર"], "ms": ["જાન્યુ", "ફેબ્રુ", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઑગસ્ટ", "સપ્ટે", "ઑક્ટો", "નવે", "ડિસે"], "wl": ["રવિવાર", "સોમવાર", "મંગળવાર", "બુધવાર", "ગુરુવાર", "શુક્રવાર", "શનિવાર"], "ws": ["રવિ", "સોમ", "મંગળ", "બુધ", "ગુરુ", "શુક્ર", "શનિ"]}, "mr": {"ml": ["जानेवारी", "फेब्रुवारी", "मार्च", "एप्रिल", "मे", "जून", "जुलै", "ऑगस्ट", "सप्टेंबर", "ऑक्टोबर", "नोव्हेंबर", "डिसेंबर"], "ms": ["जाने", "फेब्रु", "मार्च", "एप्रि", "मे", "जून", "जुलै", "ऑग", "सप्टें", "ऑक्टो", "नोव्हें", "डिसें"], "wl": ["रविवार", "सोमवार", "मंगळवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"], "ws": ["रवि", "सोम", "मंगळ", "बुध", "गुरु", "शुक्र", "शनि"]}, "bn": {"ml": ["জানুয়ারী", "ফেব্রুয়ারী", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"], "ms": ["জানু", "ফেব", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেঃ", "অক্টোঃ", "নভেঃ", "ডিসেঃ"], "wl": ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"], "ws": ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"]}, "or": {"ml": ["ଜାନୁଆରୀ", "ଫେବୃଆରୀ", "ମାର୍ଚ୍ଚ", "ଅପ୍ରେଲ", "ମଇ", "ଜୁନ", "ଜୁଲାଇ", "ଅଗଷ୍ଟ", "ସେପ୍ଟେମ୍ବର", "ଅକ୍ଟୋବର", "ନଭେମ୍ବର", "ଡିସେମ୍ବର"], "ms": ["ଜାନୁଆରୀ", "ଫେବୃଆରୀ", "ମାର୍ଚ୍ଚ", "ଅପ୍ରେଲ", "ମଇ", "ଜୁନ", "ଜୁଲାଇ", "ଅଗଷ୍ଟ", "ସେପ୍ଟେମ୍ବର", "ଅକ୍ଟୋବର", "ନଭେମ୍ବର", "ଡିସେମ୍ବର"], "wl": ["ରବିବାର", "ସୋମବାର", "ମଙ୍ଗଳବାର", "ବୁଧବାର", "ଗୁରୁବାର", "ଶୁକ୍ରବାର", "ଶନିବାର"], "ws": ["ରବି", "ସୋମ", "ମଙ୍ଗଳ", "ବୁଧ", "ଗୁରୁ", "ଶୁକ୍ର", "ଶନି"]}, "ne": {"ml": ["जनवरी", "फेब्रुअरी", "मार्च", "अप्रिल", "मे", "जुन", "जुलाई", "अगस्ट", "सेप्टेम्बर", "अक्टोबर", "नोभेम्बर", "डिसेम्बर"], "ms": ["जनवरी", "फेब्रुअरी", "मार्च", "अप्रिल", "मे", "जुन", "जुलाई", "अगस्ट", "सेप्टेम्बर", "अक्टोबर", "नोभेम्बर", "डिसेम्बर"], "wl": ["आइतबार", "सोमबार", "मङ्गलबार", "बुधबार", "बिहिबार", "शुक्रबार", "शनिबार"], "ws": ["आइत", "सोम", "मङ्गल", "बुध", "बिहि", "शुक्र", "शनि"]}};
function dtf(opts) {
  const f = new Intl.DateTimeFormat(locale(), opts), L = lang(), N = DATE_NAMES[L];
  if (!N) return f;
  const num = (d, o) => +new Intl.DateTimeFormat('en-US', { ...o, timeZone: opts.timeZone }).format(d);
  const wd = d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: opts.timeZone }).format(d));
  return { format: d => f.formatToParts(d).map(p => {
    const latin = /[A-Za-z]/.test(p.value);
    if (p.type === 'month' && (latin || opts.month === 'long' && /^\d+$/.test(p.value))) return N[opts.month === 'short' ? 'ms' : 'ml'][num(d, { month: 'numeric' }) - 1];
    if (p.type === 'weekday' && latin) return N[opts.weekday === 'short' ? 'ws' : 'wl'][wd(d)];
    return p.value;
  }).join('') };
}
const greg = (s, opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) =>
  dtf({ ...opts, timeZone: 'UTC' }).format(parse(s));
// Times on the clock the user chose: as the browser has it, twelve-hour or twenty-four.
const hourOpts = () => S.clock === 12 ? { hour12: true } : S.clock === 24 ? { hourCycle: 'h23' } : {};
const clock = u => dtf({ hour: 'numeric', minute: '2-digit', ...hourOpts(), timeZone: here().tz }).format(new Date(u * 1000));
const span = w => `${clock(w.start)} – ${clock(w.end)}`;
function tithiKey(n) {
  const k = ['pratipada', 'dvitiya', 'tritiya', 'chaturthi', 'panchami', 'shashthi', 'saptami', 'ashtami', 'navami', 'dashami', 'ekadashi', 'dvadashi', 'trayodashi', 'chaturdashi'];
  return n === 15 ? 'purnima' : n === 30 ? 'amavasya' : n <= 14 ? k[n - 1] : k[n - 16];
}
function cultureDate(solar, lunar) {
  if (pack.display.primary === 'solar' && solar) return `${name('solarMonths', solar.month)} ${solar.day}`;
  if (!lunar) return '';
  return `${lunar.adhika ? name('adhika', 'adhika') + ' ' : ''}${name('lunarMonths', lunar.month)} ${name('paksha', lunar.paksha)} ${name('tithis', tithiKey(lunar.tithi))}`;
}
function yearLabel(y) {
  if (!y) return '';
  // As on iOS: the number and the samvatsara's name where this tradition's tables carry it.
  const sv = y.samvatsara && pack.names?.samvatsaras?.[y.samvatsara] ? name('samvatsaras', y.samvatsara) : '';
  if (y.number != null) return `${name('eras', y.era)} ${y.number}${sv ? ' · ' + sv : ''}`;
  return sv ? `${sv} · ${name('eras', y.era)}` : '';
}
const tithiName = n => (n === 15 || n === 30 ? '' : name('paksha', n < 15 ? 'shukla' : 'krishna') + ' ') + name('tithis', tithiKey(n));

// ---------------------------------------------------------------- engine
async function cal(year, place = S.home) {
  const key = `${S.culture}|${place.id}|${place.latitude}|${year}`;
  if (!handles.has(key)) {
    const h = engine({ op: 'open', year, location: place, pack: packJson }).then(r => r.handle);
    // A failed open is not kept: the next screen tries again.
    h.catch(() => { if (handles.get(key) === h) handles.delete(key); });
    handles.set(key, h);
  }
  return handles.get(key);
}
async function resetCalendars() {
  // A screen still loading may hold one of these; close them a little later.
  const old = [...handles.values()];
  handles.clear();
  setTimeout(() => old.forEach(h => h.then(handle => engine({ op: 'close', handle })).catch(() => {})), 60000);
}
const day = async (s, place = S.home) => engine({ op: 'day', handle: await cal(+s.slice(0, 4), place), date: s });
async function upcoming(from, days) {
  const to = addDays(from, days); const out = [];
  for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) {
    for (const o of await engine({ op: 'festivals', handle: await cal(y) })) {
      const f = pack.festivals.find(x => x.id === o.id);
      if (f && !f.hidden && o.date >= from && o.date <= to) out.push({ f, date: o.date, how: o.how });
    }
  }
  return out.sort((a, b) => a.date < b.date ? -1 : 1);
}

// ---------------------------------------------------------------- places
let PLACES = null;
async function places() {
  if (PLACES) return PLACES;
  const tsv = await (await fetch('places.tsv?v=' + V)).text();
  PLACES = tsv.trim().split('\n').map(l => { const c = l.split('\t');
    return { id: +c[0], name: c[1], ascii: c[2].toLowerCase(), alts: c[3].toLowerCase(), country: c[4], region: c[5], latitude: +c[6], longitude: +c[7], tz: c[8], pop: +c[9] }; });
  PLACES.sort((a, b) => b.pop - a.pop);
  return PLACES;
}
async function searchPlaces(q) {
  q = q.trim().toLowerCase(); if (q.length < 2) return [];
  const all = await places();
  // A place's own name first, then an exact alternate name, then prefixes (as kaal-core's search).
  const rank = p => p.name.toLowerCase() === q || p.ascii === q ? 0 : p.alts.split('|').includes(q) ? 1
    : p.name.toLowerCase().startsWith(q) || p.ascii.startsWith(q) || p.alts.split('|').some(a => a.startsWith(q)) ? 2 : 3;
  const out = [[], [], []];
  for (const p of all) { const r = rank(p); if (r < 3) out[r].push(p); }
  return out.flat().slice(0, 20);
}
async function nearest(lat, lon) {
  const all = await places(); let best = null, bd = 1e9;
  for (const p of all) { const d = (p.latitude - lat) ** 2 + ((p.longitude - lon) * Math.cos(lat * Math.PI / 180)) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}
const plain = p => ({ id: p.id, name: p.name, region: p.region, country: p.country, latitude: p.latitude, longitude: p.longitude, tz: p.tz });
function placePicker(container, onPick) {
  container.innerHTML = `<input type="text" placeholder="${esc(t('o.search'))}" class="q">
    <button class="btn soft block" style="margin-top:8px" data-loc>📍 ${esc(t('o.useLocation'))}</button><div class="results"></div>`;
  const out = container.querySelector('.results');
  container.querySelector('.q').addEventListener('input', async e => {
    const rs = await searchPlaces(e.target.value);
    out.innerHTML = rs.map((p, i) => `<div class="list-row" data-i="${i}" style="cursor:pointer"><div class="grow"><b>${esc(p.name)}</b><div class="small muted">${esc([p.region, p.country].filter(Boolean).join(', '))}</div></div></div>`).join('');
    out.querySelectorAll('[data-i]').forEach(el => el.onclick = () => onPick(plain(rs[+el.dataset.i])));
  });
  container.querySelector('[data-loc]').onclick = () => navigator.geolocation?.getCurrentPosition(async pos => {
    const p = await nearest(pos.coords.latitude, pos.coords.longitude); if (p) onPick(plain(p));
  });
}

// ---------------------------------------------------------------- shell
function applyTheme() {
  const r = document.documentElement;
  r.dataset.theme = S.theme === 'system' ? '' : S.theme;
  r.dataset.light = S.light; r.dataset.dark = S.dark;
  r.lang = lang();
}
// A language by its own name: Hindi is हिन्दी whichever northern tradition uses it.
const LANG_NAMES = { hi: 'हिन्दी', ml: 'മലയാളം', ta: 'தமிழ்', te: 'తెలుగు', kn: 'ಕನ್ನಡ', gu: 'ગુજરાતી', mr: 'मराठी', bn: 'বাংলা', or: 'ଓଡ଼ିଆ', ne: 'नेपाली', en: 'English' };
const langName = code => LANG_NAMES[code] || code;
function shell() {
  const c = CULTURES.find(c => c.id === S.culture);
  // The tradition in the language the app is in.
  $('#badge').textContent = c ? `☀ ${S.native ? c.native : c.en} ▾` : '';
  // The tradition, switched where you are: a sheet of all fifteen, not a trip to Settings.
  $('#badge').onclick = () => {
    const o = sheet(`<h2 class="serif">${esc(t('s.tradition'))}</h2><div class="chips">${CULTURES.map(x => `<button class="chip ${S.culture === x.id ? 'on' : ''}" data-tc="${x.id}">${x.native}<br><small>${x.en}</small></button>`).join('')}</div>`);
    o.querySelectorAll('[data-tc]').forEach(b => b.onclick = async () => { o.remove(); if (b.dataset.tc === S.culture) return; S.culture = b.dataset.tc; save(); await loadPack(); await resetCalendars(); render(); });
  };
  // English or the tradition's language, beside the tradition picker.
  if (pack) { $('#langbadge').textContent = `🗣 ${S.native ? langName(pack.language) : 'English'} ▾`; $('#langbadge').onclick = () => { S.native = !S.native; save(); render(); }; }
  const house = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:4px"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>';
  // The daily five one tap away; everything else under More.
  const DAILY = ['home', 'today', 'calendar', 'festivals', 'muhurtham'], rest = TABS.filter(([id]) => !DAILY.includes(id) && (id !== 'match' || matchingAvailable()));
  $('#tabs').innerHTML = TABS.filter(([id]) => DAILY.includes(id)).map(([id, k]) => `<button data-tab="${id}" class="${id === tab ? 'on' : ''}">${id === 'home' ? house : ''}${esc(t(k))}</button>`).join('')
    + `<button data-more class="${DAILY.includes(tab) ? '' : 'on'}">${DAILY.includes(tab) ? '' : esc(t(TABS.find(([id]) => id === tab)?.[1] || 'mn.more')) + ' · '}${esc(t('mn.more'))} ▾</button>`;
  $('#tabs').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; if (tab === 'today') { dayDate = null; dayPlace = null; } render(); });
  $('#tabs').querySelector('[data-more]').onclick = () => {
    const o = sheet(`<h2 class="serif">${esc(t('mn.more'))}</h2><div class="morehub">${rest.map(([id, k]) => `<button class="tile" data-mt="${id}"><b>${esc(t(k))}</b></button>`).join('')}</div>`);
    o.querySelectorAll('[data-mt]').forEach(b => b.onclick = () => { o.remove(); tab = b.dataset.mt; render(); scrollTo(0, 0); });
  };
  // The copyright with the web build's version (the stamp build-web.sh puts on app.js).
  const build = V;
  $('#foot').innerHTML = `<div>© ${new Date().getFullYear()} Funtopia App Company · web ${build}</div><div>${esc(t('s.attribution'))}</div>`;
}
// The Eka Panchang mark blooming while something loads, as on iOS (LogoBloom).
const BLOOM = `<svg class="bloom" viewBox="-170 -170 340 340" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#B8862E"/><stop offset=".5" stop-color="#E9C266"/><stop offset="1" stop-color="#F6D47C"/></linearGradient></defs><circle class="rg" r="156" fill="none" stroke="#E9C266" stroke-width="2" pathLength="1"/><circle r="148" fill="none" stroke="#E9C266" stroke-opacity=".7" stroke-width="1" stroke-dasharray="1.5 4"/><path class="dm" transform="rotate(22.5) translate(0,-150)" d="M0 -6 L4 0 L0 6 L-4 0Z" fill="#E9C266"/><path class="dm" transform="rotate(67.5) translate(0,-150)" d="M0 -6 L4 0 L0 6 L-4 0Z" fill="#E9C266"/><path class="dm" transform="rotate(112.5) translate(0,-150)" d="M0 -6 L4 0 L0 6 L-4 0Z" fill="#E9C266"/><path class="dm" transform="rotate(157.5) translate(0,-150)" d="M0 -6 L4 0 L0 6 L-4 0Z" fill="#E9C266"/><path class="dm" transform="rotate(202.5) translate(0,-150)" d="M0 -6 L4 0 L0 6 L-4 0Z" fill="#E9C266"/><path class="dm" transform="rotate(247.5) translate(0,-150)" d="M0 -6 L4 0 L0 6 L-4 0Z" fill="#E9C266"/><path class="dm" transform="rotate(292.5) translate(0,-150)" d="M0 -6 L4 0 L0 6 L-4 0Z" fill="#E9C266"/><path class="dm" transform="rotate(337.5) translate(0,-150)" d="M0 -6 L4 0 L0 6 L-4 0Z" fill="#E9C266"/><g class="pt" style="--i:0" transform="rotate(0) translate(0,-50)"><path d="M0 0 C-44 -28 -30 -82 0 -104 C30 -82 44 -28 0 0Z" fill="url(#lg)"/><path d="M0 0 L0 -100 M0 -26 Q-6 -32 -14 -36 M0 -26 Q6 -32 14 -36 M0 -50 Q-7 -56 -15 -62 M0 -50 Q7 -56 15 -62 M0 -72 Q-5 -77 -10 -82 M0 -72 Q5 -77 10 -82" fill="none" stroke="#B8862E" stroke-width="1"/></g><g class="pt" style="--i:1" transform="rotate(60) translate(0,-50)"><path d="M0 0 C-44 -28 -30 -82 0 -104 C30 -82 44 -28 0 0Z" fill="url(#lg)"/><path d="M0 0 L0 -100 M0 -26 Q-6 -32 -14 -36 M0 -26 Q6 -32 14 -36 M0 -50 Q-7 -56 -15 -62 M0 -50 Q7 -56 15 -62 M0 -72 Q-5 -77 -10 -82 M0 -72 Q5 -77 10 -82" fill="none" stroke="#B8862E" stroke-width="1"/></g><g class="pt" style="--i:2" transform="rotate(120) translate(0,-50)"><path d="M0 0 C-44 -28 -30 -82 0 -104 C30 -82 44 -28 0 0Z" fill="url(#lg)"/><path d="M0 0 L0 -100 M0 -26 Q-6 -32 -14 -36 M0 -26 Q6 -32 14 -36 M0 -50 Q-7 -56 -15 -62 M0 -50 Q7 -56 15 -62 M0 -72 Q-5 -77 -10 -82 M0 -72 Q5 -77 10 -82" fill="none" stroke="#B8862E" stroke-width="1"/></g><g class="pt" style="--i:3" transform="rotate(180) translate(0,-50)"><path d="M0 0 C-44 -28 -30 -82 0 -104 C30 -82 44 -28 0 0Z" fill="url(#lg)"/><path d="M0 0 L0 -100 M0 -26 Q-6 -32 -14 -36 M0 -26 Q6 -32 14 -36 M0 -50 Q-7 -56 -15 -62 M0 -50 Q7 -56 15 -62 M0 -72 Q-5 -77 -10 -82 M0 -72 Q5 -77 10 -82" fill="none" stroke="#B8862E" stroke-width="1"/></g><g class="pt" style="--i:4" transform="rotate(240) translate(0,-50)"><path d="M0 0 C-44 -28 -30 -82 0 -104 C30 -82 44 -28 0 0Z" fill="url(#lg)"/><path d="M0 0 L0 -100 M0 -26 Q-6 -32 -14 -36 M0 -26 Q6 -32 14 -36 M0 -50 Q-7 -56 -15 -62 M0 -50 Q7 -56 15 -62 M0 -72 Q-5 -77 -10 -82 M0 -72 Q5 -77 10 -82" fill="none" stroke="#B8862E" stroke-width="1"/></g><g class="pt" style="--i:5" transform="rotate(300) translate(0,-50)"><path d="M0 0 C-44 -28 -30 -82 0 -104 C30 -82 44 -28 0 0Z" fill="url(#lg)"/><path d="M0 0 L0 -100 M0 -26 Q-6 -32 -14 -36 M0 -26 Q6 -32 14 -36 M0 -50 Q-7 -56 -15 -62 M0 -50 Q7 -56 15 -62 M0 -72 Q-5 -77 -10 -82 M0 -72 Q5 -77 10 -82" fill="none" stroke="#B8862E" stroke-width="1"/></g><circle r="56" fill="#004B45"/><g class="gl" fill="none" stroke="#E9C266" stroke-width="1.4"><circle r="25"/><path d="M-22 -12 H22 M-25 0 H25 M-22 12 H22"/><ellipse class="mer" rx="12" ry="25"/><ellipse class="mer m2" rx="6" ry="25"/></g></svg>`;
function loading() { $('#main').innerHTML = `<div class="loading">${BLOOM}<div class="muted">${esc(t('o.tagline'))}</div></div>`; }
function sheet(html, onOpen) {
  const o = document.createElement('div'); o.className = 'overlay';
  o.innerHTML = `<div class="sheet"><button class="btn soft close noprint">${esc(t('c.close'))}</button>${html}</div>`;
  // A sheet still saving stays open until it is done.
  o.onclick = e => { if (e.target === o && !o.dataset.busy) o.remove(); };
  o.querySelector('.close').onclick = () => { if (!o.dataset.busy) o.remove(); };
  document.body.appendChild(o); onOpen?.(o); return o;
}

async function render() {
  applyTheme(); applyTextSize(); shell();
  if (!S.culture || !S.home) return onboarding();
  try {
    if (tab === 'home') return await viewHome();
    if (tab === 'today') return await viewDay();
    if (tab === 'calendar') return await viewMonth();
    if (tab === 'festivals') return await viewFestivals();
    if (tab === 'muhurtham') return viewMuhurtham();
    if (tab === 'birthstar') return viewBirthStar();
    if (tab === 'match') return await viewMatch();
    if (tab === 'guide') return viewGuide();
    if (tab === 'greetings') return await viewGreetings();
    if (tab === 'vrats') return await viewVrats();
    if (tab === 'jathakam') return await viewJathakam();
    if (tab === 'temples') return await viewTemples();
    if (tab === 'prayers') return await viewPrayers();
    if (tab === 'oldtime') return await viewOldTime();
    if (tab === 'sky') return await viewSky();
    if (tab === 'people') return await viewPeople();
    if (tab === 'settings') return viewSettings();
  } catch (e) { $('#main').innerHTML = `<div class="card">${esc(t('c.error', e.message))}</div>`; }
}

// ---------------------------------------------------------------- onboarding
function onboarding() {
  $('#tabs').innerHTML = '';
  $('#main').innerHTML = `<div class="card"><h1 class="serif" style="margin:0">Eka Panchang</h1><p class="muted">${esc(t('o.welcome'))}</p>
    <p class="label">${esc(t('o.question'))}</p><div class="chips">${CULTURES.map(c => `<button class="chip ${S.culture === c.id ? 'on' : ''}" data-c="${c.id}">${c.native}<br><small>${c.en}</small></button>`).join('')}</div></div>
    <div class="card"><p class="label">${esc(t('o.where'))}</p><p class="small muted">${esc(t('o.whereNote'))}</p><div id="pp"></div></div>`;
  $('#main').querySelectorAll('[data-c]').forEach(b => b.onclick = async () => { S.culture = b.dataset.c; save(); await loadPack(); onboarding(); });
  placePicker($('#pp'), async p => { S.home = p; save(); await resetCalendars(); render(); });
}

// ---------------------------------------------------------------- home
// As on iOS (HomeView): today's panchangam above a tile for every feature,
// each with one live fact; a tile opens its tab.
// "10:42 AM Kollam · 6:12 AM Dubai".
function clocks() {
  return [S.home, S.away].filter(Boolean).map(p => `${dtf({ hour: 'numeric', minute: '2-digit', ...hourOpts(), timeZone: p.tz }).format(new Date())} ${p.name}`).join(' · ');
}
// The time since sunrise in the tradition's units (24 minutes, 24 seconds).
function sinceSunrise(sunrise) {
  const u = pack?.display?.timeUnits; if (!u || !sunrise) return '';
  const names = (lang() === 'en' ? u.en : u.native) || u.en;
  let s = Date.now() / 1000 - sunrise; if (s < 0) s += 86400;
  return t('hm.sinceSunrise', `${Math.floor(s / 1440)} ${names[0]} ${Math.floor((s % 1440) / 24)} ${names[1]}`);
}
let homeTick = null;
// Home's tiles in the user's order (S.tileOrder); new tiles join at the end.
function orderTiles(tiles) {
  const key = h => h.match(/data-k="([^"]+)"/)[1], o = S.tileOrder;
  return tiles.map((h, i) => [h, o.indexOf(key(h)) < 0 ? o.length + i : o.indexOf(key(h))]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
}
const moonPhase = i => !i ? '🌑' : i === 15 ? '🌕' : i === 30 ? '🌑' : i <= 3 ? '🌒' : i <= 8 ? '🌓' : i < 15 ? '🌔' : i <= 21 ? '🌖' : i <= 26 ? '🌗' : '🌘';
// A faint mandala of petals for the panchangam card.
const PETALS = (() => {
  let d = '';
  for (const [r, n, off] of [[100, 12, 0], [62, 12, Math.PI / 12]]) for (let i = 0; i < n; i++) {
    const a = i / n * 2 * Math.PI + off, tx = 100 + Math.cos(a) * r, ty = 100 + Math.sin(a) * r, mx = 100 + Math.cos(a) * r / 2, my = 100 + Math.sin(a) * r / 2, w = r * .28, sa = a + Math.PI / 2;
    d += `M100 100Q${(mx + Math.cos(sa) * w).toFixed(1)} ${(my + Math.sin(sa) * w).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}Q${(mx - Math.cos(sa) * w).toFixed(1)} ${(my - Math.sin(sa) * w).toFixed(1)} 100 100`;
  }
  return `<svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="1.2"><path d="${d}"/><circle cx="100" cy="100" r="18"/></svg>`;
})();
// The day's sky on the panchangam card, as on iOS (SkyStrip.swift): the sun's arc from sunrise
// to sunset and the moon's from moonrise to moonset across the day's hours; on opening, both travel
// to where they are now. Drawn as SVG; the sun glows and the stars twinkle in CSS.
function skyStrip(p, tz) {
  const W = 320, H = 84, hz = H - 24, lift = hz - 6, D = 86400;
  const mid = (() => { const [y, m, d] = civilIn(p.sunrise).split('-').map(Number), probe = Date.UTC(y, m - 1, d) / 1000;
    const off = (new Date(probe * 1000).toLocaleString('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' })).split(':').map(Number);
    const o = (off[0] % 24) * 3600 + off[1] * 60; return probe - (o > 43200 ? o - 86400 : o); })();
  const x = t => ((t - mid) / D) * W;
  const height = (t, rise, span, amp) => { let f = ((t - rise) % D + D) % D; return span > 0 && f <= span ? Math.sin(Math.PI * f / span) * amp : null; };
  const arc = (rise, span, amp) => { let d = '', up = false;
    for (let i = 0; i <= 240; i++) { const t = mid + i / 240 * D, h = height(t, rise, span, amp);
      if (h !== null) { d += up ? `L${x(t).toFixed(1)} ${(hz - h).toFixed(1)}` : `M${x(t).toFixed(1)} ${hz}L${x(t).toFixed(1)} ${(hz - h).toFixed(1)}`; up = true; }
      else if (up) { d += `V${hz}`; up = false; } }
    return d; };
  const sunSpan = p.sunset - p.sunrise, moonSpan = p.moonrise && p.moonset ? (((p.moonset - p.moonrise) % D) + D) % D || D : 0;
  const now = Date.now() / 1000, night = now < p.sunrise || now > p.sunset;
  const stars = night ? Array.from({ length: 14 }, (_, i) => `<circle class="star" style="animation-delay:${(i * .37 % 3).toFixed(2)}s" cx="${(i * 73 % 100) / 100 * W}" cy="${(i * 37 % 60) / 100 * hz + 4}" r="1"/>`).join('') : '';
  const lab = (t, s) => `<text x="${Math.min(Math.max(x(t), 30), W - 30)}" y="${hz + 15}" text-anchor="middle">${esc(s)}</text>`;
  return `<svg class="sky" viewBox="0 0 ${W} ${H}" data-mid="${mid}" data-rise="${p.sunrise}" data-sun="${sunSpan}" data-mrise="${p.moonrise || 0}" data-moon="${moonSpan}" aria-label="☀ ${esc(clock(p.sunrise))} – ${esc(clock(p.sunset))}">
    <defs><linearGradient id="skyfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--gold)" stop-opacity=".4"/><stop offset="1" stop-color="var(--gold)" stop-opacity=".02"/></linearGradient></defs>
    ${stars}${moonSpan ? `<path d="${arc(p.moonrise, moonSpan, lift * .72)}" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="1.2" stroke-dasharray="3 4"/>` : ''}
    <path d="${arc(p.sunrise, sunSpan, lift)}" fill="url(#skyfill)" stroke="var(--gold)" stroke-width="1.6"/>
    <line x1="0" y1="${hz}" x2="${W}" y2="${hz}" stroke="currentColor" stroke-opacity=".35"/>
    <line class="nowline" y1="4" y2="${hz}" stroke="currentColor" stroke-opacity=".2" stroke-dasharray="2 3"/>
    <text class="moonnow" font-size="15" text-anchor="middle" dominant-baseline="central">${moonPhase(p.tithis[0]?.index)}</text>
    <g class="sunnow"><circle class="glow" r="16" fill="var(--gold)" opacity=".15"/><circle r="11" fill="var(--gold)" opacity=".25"/><circle r="7" fill="var(--gold)"/></g>
    ${lab(p.sunrise, '↑ ' + clock(p.sunrise))}${lab(p.sunset, '↓ ' + clock(p.sunset))}</svg>`;
}
// Move the sun and moon from midnight to now over a second and a half.
function animateSky(svg) {
  if (!svg) return;
  const n = k => +svg.dataset[k], mid = n('mid'), W = 320, hz = 60, lift = hz - 6, D = 86400, t0 = performance.now();
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const height = (t, rise, span, amp) => { let f = ((t - rise) % D + D) % D; return span > 0 && f <= span ? Math.sin(Math.PI * f / span) * amp : null; };
  const step = ts => {
    const p = still ? 1 : Math.min(1, (ts - t0) / 1600), e = 1 - (1 - p) ** 3, real = Date.now() / 1000, now = mid + (real - mid) * e, x = (now - mid) / D * W;
    const sh = height(now, n('rise'), n('sun'), lift), mh = n('moon') ? height(now, n('mrise'), n('moon'), lift * .72) : null;
    const sun = svg.querySelector('.sunnow'), moon = svg.querySelector('.moonnow'), line = svg.querySelector('.nowline');
    line.setAttribute('x1', x); line.setAttribute('x2', x);
    sun.style.display = sh === null ? 'none' : ''; if (sh !== null) sun.setAttribute('transform', `translate(${x} ${hz - sh})`);
    moon.style.display = mh === null ? 'none' : ''; if (mh !== null) { moon.setAttribute('x', x); moon.setAttribute('y', hz - mh); }
    if (p < 1 && svg.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
// ---------------------------------------------------------------- tarabalam
// As on iOS (Core/Tara.swift): a day's nakshatra counted from a person's birth star in nines.
const STARS27 = ['ashwini', 'bharani', 'krittika', 'rohini', 'mrigashira', 'ardra', 'punarvasu', 'pushya', 'ashlesha', 'magha', 'purva_phalguni',
  'uttara_phalguni', 'hasta', 'chitra', 'swati', 'vishakha', 'anuradha', 'jyeshtha', 'mula', 'purva_ashadha', 'uttara_ashadha', 'shravana',
  'dhanishta', 'shatabhisha', 'purva_bhadrapada', 'uttara_bhadrapada', 'revati'];
const RASHIS12 = ['mesha', 'vrishabha', 'mithuna', 'karka', 'simha', 'kanya', 'tula', 'vrishchika', 'dhanu', 'makara', 'kumbha', 'meena'];
const starPerson = () => { const ps = S.people.filter(p => p.kind !== 'remembrance' && p.anchor?.nakshatra); return ps.find(p => p.id === S.starPerson) || ps.find(p => p.relation === 'self') || ps[0]; };
const taraOf = (birth, day) => { const b = STARS27.indexOf(birth), d = STARS27.indexOf(day); return b < 0 || d < 0 ? 0 : ((d - b + 27) % 27) % 9 + 1; };
const taraBand = t => [2, 4, 6, 8, 9].includes(t) ? 0 : t === 1 ? 1 : 2;
function starLine(p, nak, end) {
  const tr = taraOf(p.anchor.nakshatra, nak); if (!tr) return '';
  const b = taraBand(tr);
  return b === 0 ? t('star.good', p.name, clock(end), t('taraN.' + tr)) : b === 1 ? t('star.janma', p.name, clock(end)) : t('star.other', p.name, t('taraN.' + tr), clock(end));
}
const chandrashtamam = (natal, moon) => { const a = RASHIS12.indexOf(natal), b = RASHIS12.indexOf(moon); return a >= 0 && b >= 0 && (b - a + 12) % 12 === 7; };

// The day for one person's star, as on iOS (StarCard): each nakshatra's tara, and Chandrashtamam.
function starCard(sp, p, fine, d) {
  const rows = p.nakshatras.map(n => { const tr = taraOf(sp.anchor.nakshatra, n.key); return tr ? `<div class="row"><span><i class="ringdot rb${taraBand(tr)}"></i>${esc(name('nakshatras', n.key))} · ${esc(t('taraN.' + tr))}</span><span class="v small">${esc(windowText(n.start, n.end, d))}</span></div>` : ''; }).join('');
  const ch = (fine.moonSigns || []).filter(m => chandrashtamam(sp.anchor.moonSign, m.key)).map(m => `<p class="small muted">${esc(t('today.chandrashtamam', sp.name, clock(m.end)))}</p>`).join('');
  return `<div class="card"><p class="label">${esc(t('today.forStar', sp.name))}</p>${rows}${ch}</div>`;
}

// ---------------------------------------------------------------- dial
// As on iOS (DialView): the day as a dial - what is running now, when it ends, what comes next.
// Outer ring: the half's eight Choghadiyas or twelve horas; inner ring: Rahu, Yama and Gulika,
// with Abhijit and Brahma Muhurta as diamonds. Drag to look at another hour; tap a period for its details.
const DIAL = { mode: 0, half: null, scrub: null };
async function openDial(date) {
  const o = sheet('<div id="dial" class="dialwrap"></div>');
  o.classList.add('full');
  let d = date, cur = null;
  const cache = {};
  const draw = async () => {
    const now = Date.now() / 1000;
    if (!cur) { const td = today(), p0 = await day(td); cur = now < p0.sunrise ? addDays(td, -1) : td; if (d === td && cur !== td) d = cur; }
    // Fetched once per date, so dragging redraws without asking the engine again.
    const [p, nx, fine] = cache[d] ||= await Promise.all([day(d), day(addDays(d, 1)), engine({ op: 'timings', handle: await cal(+d.slice(0, 4)), date: d })]);
    const isDay = DIAL.half ?? (d !== cur ? true : now >= p.sunrise && now < p.sunset);
    const a = isDay ? p.sunrise : p.sunset, b = isDay ? p.sunset : nx.sunrise;
    const kind = DIAL.mode === 1 ? 'hora' : 'choghadiya';
    const segs = DIAL.mode === 2 ? [] : fine[kind].filter(x => x.start >= a - 60 && x.end <= b + 60).map(x => ({ ...x, kind }));
    const wins = [['rahu', p.rahuKalam], ['yama', p.yamagandam], ['gulika', p.gulikaKalam]].map(([k, w]) => ({ key: k, start: w.start, end: w.end, kind: 'window' })).filter(w => w.end > a && w.start < b);
    const marks = [...(p.weekday !== 'wednesday' ? [{ key: 'abhijit', ...p.abhijit, kind: 'window' }] : []), { key: 'brahma', ...nx.brahmaMuhurta, kind: 'window' }].filter(m => m.start >= a && m.end <= b);
    const nm = x => x.kind === 'hora' ? name('grahas', x.key) : x.kind === 'choghadiya' ? name('choghadiya', x.key) : t({ rahu: 'time.rahu', yama: 'time.yama', gulika: 'time.gulika', abhijit: 'time.abhijit', brahma: 'time.brahma' }[x.key]);
    const short = x => x.kind === 'hora' ? name('grahaShort', x.key) : nm(x);
    const nature = x => x.kind === 'choghadiya' ? (['amrita', 'shubha', 'labha'].includes(x.key) ? 0 : x.key === 'chara' ? 1 : 2) : x.kind === 'hora' ? (['moon', 'mercury', 'jupiter', 'venus'].includes(x.key) ? 0 : 1) : 2;
    const W = 360, C = 180, R = 138, band = 34, inner = R - band - 12, TAU = Math.PI * 2;
    const ang = u => (u - a) / (b - a) * TAU - Math.PI / 2, pt = (r, an) => [C + Math.cos(an) * r, C + Math.sin(an) * r];
    const arc = (r, u0, u1) => { const [x0, y0] = pt(r, ang(u0)), [x1, y1] = pt(r, ang(u1)), large = ang(u1) - ang(u0) > Math.PI ? 1 : 0; return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
    const showNow = d === cur && now >= a && now < b, tt = DIAL.scrub ?? now;
    const list = DIAL.mode === 2 ? [...wins, ...marks].sort((x, y) => x.start - y.start) : segs;
    const run = list.find(x => tt >= x.start && tt < x.end), nxt = list.find(x => x.start > tt);
    const wr = DIAL.mode === 2 ? R - band / 2 : inner, ww = DIAL.mode === 2 ? band - 6 : 12;
    let labels = '';
    let svg = DIAL.mode === 2 ? `<circle cx="${C}" cy="${C}" r="${R - band / 2}" fill="none" stroke="var(--sunken)" stroke-width="${band}"/>` : '';
    segs.forEach((x, i) => { const n = nature(x);
      svg += `<path data-seg="${i}" d="${arc(R - band / 2, x.start, x.end)}" fill="none" stroke="${n === 0 ? 'var(--accent)' : n === 1 ? 'color-mix(in srgb, var(--accent) 45%, transparent)' : 'var(--sunken)'}" stroke-width="${band - 2}"/>`;
      if (n === 2) svg += `<path d="${arc(R - band + 1, x.start, x.end)}" fill="none" stroke="var(--muted)" stroke-opacity=".45"/><path d="${arc(R - 1, x.start, x.end)}" fill="none" stroke="var(--muted)" stroke-opacity=".45"/>`;
      // Labels are drawn after the hand, so it never cuts one; a period too narrow for its name stays unlabelled,
      // and at the sides, where a name runs across the band, it is set small enough to stay inside it.
      const mid = ang((x.start + x.end) / 2), [lx, ly] = pt(R - band / 2, mid), nmx = short(x);
      const arcLen = (R - band / 2) * (x.end - x.start) / (b - a) * TAU, across = Math.abs(Math.cos(mid)) * nmx.length * 6;
      if (arcLen >= nmx.length * 6 + 6) labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="dl ${n === 0 ? 'on' : ''}" style="font-weight:${n === 2 ? 400 : 700};font-size:${across > band - 6 ? Math.max(7, 10 * (band - 6) / across).toFixed(1) : 10}px">${esc(nmx)}</text>`; });
    if (DIAL.mode !== 2) svg += `<circle cx="${C}" cy="${C}" r="${inner}" fill="none" stroke="var(--line)"/>`;
    wins.forEach((w, i) => { const s0 = Math.max(w.start, a), s1 = Math.min(w.end, b), [lx, ly] = pt(DIAL.mode === 2 ? R - band - 14 : inner, ang((s0 + s1) / 2));
      svg += `<path data-win="${i}" d="${arc(wr, s0, s1)}" fill="none" stroke="var(--ink)" stroke-opacity=".7" stroke-width="${ww}" stroke-linecap="round"/><path d="${arc(wr, s0, s1)}" fill="none" stroke="url(#hatch)" stroke-width="${ww - 4}" stroke-linecap="round" pointer-events="none"/>
`;
      // On the window's own ring, haloed in the page colour, clear of the centre's words.
      labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="dl halo" style="font-weight:600">${esc(t('dial.w.' + w.key))}</text>`; });
    // The chosen person's tarabalam around the half: each nakshatra's stretch, counted from their birth star.
    { const spx = starPerson(); if (spx) [...p.nakshatras, ...(nx.nakshatras || [])].forEach(n => {
      const s0 = Math.max(n.start, a), s1 = Math.min(n.end, b), tr = taraOf(spx.anchor.nakshatra, n.key); if (s1 <= s0 || !tr) return;
      const band = taraBand(tr);
      svg += `<path d="${arc(R + 5, s0, s1)}" fill="none" stroke="${band === 2 ? 'var(--muted)' : 'var(--gold)'}" stroke-opacity="${band === 2 ? 0.3 : 1}" stroke-width="5"${band === 1 ? ' stroke-dasharray="4 3"' : ''}/>`;
    }); }
    marks.forEach(m => { const [x, y] = pt(inner, ang((m.start + m.end) / 2)); svg += `<path d="M${x} ${y - 8}L${x + 6} ${y}L${x} ${y + 8}L${x - 6} ${y}Z" fill="var(--gold)"><title>${esc(nm(m))}</title></path>`; });
    const edges = segs.length ? segs.map(x => x.start) : [...wins, ...marks].flatMap(x => [x.start, x.end]);
    [...new Set(edges)].filter(u => u >= a && u < b).forEach(u => { const [x, y] = pt(R + 22, ang(u)); svg += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="dt">${esc(clock(u))}</text>`; });
    if (showNow || DIAL.scrub != null) { const e = ang(tt), [x0, y0] = pt(inner - 10, e), [x1, y1] = pt(R + 6, e), col = DIAL.scrub == null ? 'var(--accent)' : 'var(--gold)';
      svg += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${col}" stroke-width="3" stroke-linecap="round"/><circle cx="${x1}" cy="${y1}" r="5" fill="${col}"/>`; }
    svg += labels;
    // Whose star the chip reads: the same choice as the calendar's marks, changeable here.
    const births = S.people.filter(x => x.kind !== 'remembrance' && x.anchor?.nakshatra);
    const sp = starPerson(), nk = p.nakshatras.find(n => n.start <= tt && tt < n.end), pl = sp && nk ? starLine(sp, nk.key, nk.end) : '';
    const mins = run ? Math.floor((run.end - now) / 60) : 0;
    const centre = DIAL.scrub != null ? `<div class="small" style="font-weight:600">${esc(t('dial.at', clock(DIAL.scrub), run ? nm(run) : '–', run ? clock(run.end) : ''))}</div><button class="linkbtn" data-now>${esc(t('dial.backNow'))}</button>`
      : run && showNow ? `<div class="serif dbig">${esc(nm(run))}</div><div class="small" style="color:var(--accent);font-weight:700">${esc(t('dial.endsIn', nm(run), mins >= 60 ? t('dial.hm', Math.floor(mins / 60), mins % 60) : t('dial.m', mins)))}</div>`
      : list[0] ? `<div class="serif dbig">${esc(nm(list[0]))}</div><div class="small muted">${esc(clock(list[0].start))} – ${esc(clock(list[0].end))}</div>` : '';
    const after = DIAL.scrub == null ? (nxt ? `<div class="small muted">${esc(t('dial.nextAt', nm(nxt), clock(nxt.start)))}</div>` : showNow ? `<div class="small muted">${esc(t(isDay ? 'sun.sunset' : 'sun.sunrise'))} ${esc(clock(b))}</div>` : '') : '';
    o.querySelector('#dial').innerHTML = `
      <div class="dialdate"><button class="arrow" data-dd="-1">‹</button><div><b>${esc(greg(d))}</b><div class="small muted">${esc(cultureDate(p.solar, p.lunar))}</div>${d !== cur ? `<button class="linkbtn" data-dcur>${esc(t('day.jumpToday'))}</button>` : ''}</div><button class="arrow" data-dd="1">›</button></div>
      <div style="display:flex;gap:8px"><div class="seg" style="flex:1">${['dm.choghadiya', 'dm.hora', 'dial.windows'].map((k, i) => `<button data-dm="${i}" class="${DIAL.mode === i ? 'on' : ''}">${esc(t(k))}</button>`).join('')}</div>
        <div class="seg"><button data-dh="1" class="${isDay ? 'on' : ''}" aria-label="${esc(t('dm.day'))}">☀</button><button data-dh="0" class="${!isDay ? 'on' : ''}" aria-label="${esc(t('dm.night'))}">☾</button></div></div>
      <div class="dialbox"><svg viewBox="0 0 ${W} ${W}" class="dialsvg"><defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="var(--paper)"/><line x1="0" y1="0" x2="0" y2="5" stroke="var(--ink)" stroke-opacity=".5" stroke-width="1.2"/></pattern></defs>${svg}</svg>
        <div class="dialc">${centre}${after}</div></div>
      ${pl ? `<div style="text-align:center"><span class="pchip">${esc(pl)}</span>${births.length > 1 ? `<div><label class="small">👤 <select id="dialfor">${births.map(x => `<option value="${x.id}" ${x.id === sp.id ? 'selected' : ''}>${esc(t('cal.for', x.name))}</option>`).join('')}</select></label></div>` : ''}</div>` : ''}
      <div class="diallegend">${DIAL.mode !== 2 ? `<span><i style="background:var(--accent)"></i>${esc(t(DIAL.mode === 1 ? 'dial.benefic' : 'nature.s'))}</span>${DIAL.mode === 0 ? `<span><i style="background:color-mix(in srgb, var(--accent) 45%, transparent)"></i>${esc(t('nature.m'))}</span>` : ''}${DIAL.mode === 0 ? `<span><i style="border:1px solid var(--muted)"></i>${esc(t('nature.a'))}</span>` : `<span><i style="background:color-mix(in srgb, var(--accent) 45%, transparent)"></i>${esc(t('dial.other'))}</span>`}<br>` : ''}
        <span>⟋ ${esc(t('dial.kalams'))}</span><span style="color:var(--gold)">◆</span> ${esc(t('dial.muhurtas'))}
        ${starPerson() ? `<br><span><i style="background:var(--gold);border-radius:2px;height:4px"></i>${esc(t('cal.ring0'))}</span><span><i style="border:2px dashed var(--gold);border-radius:2px;height:0"></i>${esc(t('cal.ring1'))}</span>` : ''}</div>
      <div id="dialdetail"></div>`;
    const q = (x, f) => o.querySelectorAll(x).forEach(f);
    q('[data-dd]', b2 => b2.onclick = () => { d = addDays(d, +b2.dataset.dd); DIAL.scrub = null; draw(); });
    q('[data-dcur]', b2 => b2.onclick = () => { d = cur; DIAL.scrub = null; draw(); });
    q('[data-dm]', b2 => b2.onclick = () => { DIAL.mode = +b2.dataset.dm; draw(); });
    q('[data-dh]', b2 => b2.onclick = () => { DIAL.half = b2.dataset.dh === '1'; DIAL.scrub = null; draw(); });
    q('[data-now]', b2 => b2.onclick = () => { DIAL.scrub = null; draw(); });
    o.querySelector('#dialfor')?.addEventListener('change', e => { S.starPerson = e.target.value; save(); draw(); });
    const detail = x => { const n = nature(x), m = Math.round((x.end - x.start) / 60);
      o.querySelector('#dialdetail').innerHTML = `<div class="card"><h3 class="serif" style="margin:0">${esc(nm(x))}</h3><div style="color:var(--accent);font-weight:700">${esc(clock(x.start))} – ${esc(clock(x.end))} · ${esc(t('dial.min', m))}</div>
        ${x.kind === 'choghadiya' ? `<div class="small" style="font-weight:600">${esc(t(['nature.shubha', 'nature.madhyama', 'nature.ashubha'][n]))}</div>` : ''}<p>${esc(t('use.' + x.key))}</p></div>`; };
    q('[data-seg]', el => el.onclick = () => detail(segs[+el.dataset.seg]));
    q('[data-win]', el => el.onclick = () => detail(wins[+el.dataset.win]));
    // Drag around the dial to look at another hour.
    const svgEl = o.querySelector('.dialsvg'); let dragging = false;
    const timeAt = e => { const r = svgEl.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W - C, y = (e.clientY - r.top) / r.height * W - C;
      let an = Math.atan2(y, x) + Math.PI / 2; if (an < 0) an += TAU; return a + (b - a) * an / TAU; };
    svgEl.onpointerdown = e => { dragging = false; svgEl.setPointerCapture(e.pointerId); svgEl._start = [e.clientX, e.clientY]; };
    svgEl.onpointermove = e => { if (!svgEl._start) return; if (Math.hypot(e.clientX - svgEl._start[0], e.clientY - svgEl._start[1]) > 8) { dragging = true; DIAL.scrub = timeAt(e); draw(); } };
    svgEl.onpointerup = () => { svgEl._start = null; };
  };
  await draw();
  const tick = setInterval(() => { if (!o.isConnected) return clearInterval(tick); if (DIAL.scrub == null) draw(); }, 60000);
}
const TILE_STYLES = ['classic', 'mosaic', 'colourful', 'minimal'];
// Reorder Home's tiles, put what's coming soonest first, juggle, and pick a style.
function arrangeSheet(keys, x) {
  let order = orderTiles(keys.map(k => `data-k="${k}"`)).map(h => h.match(/data-k="([^"]+)"/)[1]);
  const label = k => ({ festivals: t('tab.festivals'), day: t('dm.title'), vrats: t('vj.title'), calendar: t('tab.calendar'), jathakam: t('jk.chart'), sky: t('sk.title'), temples: t('tm.title'), people: t('fam.family'), match: t('mt.label'), greetings: t('gr.title'), birthstar: t('bs.result'), settings: t('tab.settings') })[k] || k;
  const o = sheet('<div id="arr"></div>');
  const draw = () => {
    o.querySelector('#arr').innerHTML = `<h2 class="serif">${esc(t('hm.arrange'))}</h2>
      <p class="label">${esc(t('ar.style'))}</p><div class="chips">${TILE_STYLES.map(st => `<button class="chip ${S.tileStyle === st ? 'on' : ''}" data-st="${st}">${esc(t('ar.s.' + st))}</button>`).join('')}</div>
      <div class="card"><button class="linkbtn block" data-auto>✨ ${esc(t('ar.auto'))}</button><button class="linkbtn block" data-shuf>🔀 ${esc(t('ar.shuffle'))}</button><button class="linkbtn block" data-reset>↺ ${esc(t('ar.reset'))}</button>
      <p class="small muted">${esc(t('ar.autoNote'))}</p></div>
      <p class="label">${esc(t('ar.order'))}</p><div class="card">${order.map((k, i) => `<div class="list-row"><span class="grow">${esc(label(k))}</span><button class="arrow" data-up="${i}" aria-label="Up">↑</button><button class="arrow" data-dn="${i}" aria-label="Down">↓</button></div>`).join('')}</div>
      <button class="btn block" data-done>${esc(t('c.done'))}</button>`;
    const q = (sel, f) => o.querySelectorAll(sel).forEach(b => b.onclick = () => { f(b); draw(); });
    q('[data-st]', b => { S.tileStyle = b.dataset.st; });
    q('[data-up]', b => { const i = +b.dataset.up; if (i > 0) [order[i - 1], order[i]] = [order[i], order[i - 1]]; });
    q('[data-dn]', b => { const i = +b.dataset.dn; if (i < order.length - 1) [order[i + 1], order[i]] = [order[i], order[i + 1]]; });
    q('[data-reset]', () => { order = [...keys]; });
    q('[data-shuf]', () => { order.sort(() => Math.random() - .5); S.tileStyle = TILE_STYLES.filter(s => s !== S.tileStyle)[Math.floor(Math.random() * 3)]; });
    q('[data-auto]', () => {
      const n = s => s ? daysBetween(x.d, s) : 999;
      const soon = { festivals: n(x.fest?.date), greetings: n(x.greet?.date) + 1, people: n(x.person?.date), vrats: n(x.vrat?.date), day: 0 };
      order = keys.map((k, i) => [k, soon[k] ?? 500 + i]).sort((a, b) => a[1] - b[1]).map(y => y[0]);
    });
    o.querySelector('[data-done]').onclick = () => { S.tileOrder = order; save(); o.remove(); viewHome(); };
  };
  draw();
}
async function viewHome() {
  await loadPrayers().catch(() => {});
  const d = today();
  dayDate = null; dayPlace = null;
  loading();
  const p = await day(d);
  const fine = await engine({ op: 'timings', handle: await cal(+d.slice(0, 4)), date: d }).catch(() => null);
  const coming = await upcoming(d, 180);
  const fest = coming.find(x => x.f.tier !== 'minor' && x.date <= addDays(d, 90));
  const greet = coming.find(x => x.f.tier !== 'minor');
  const vrat = (await vratDays(d, addDays(d, 14)))[0];
  const now = Date.now() / 1000;
  let person = null;
  for (const x of S.people) {
    if (!x.anchor) continue;
    for (const y of [+d.slice(0, 4), +d.slice(0, 4) + 1]) {
      const ds = await engine({ op: 'personalDates', handle: await cal(y), anchor: x.anchor, kind: x.kind || 'birthday', basis: x.basis }).catch(() => []);
      const next = ds.find(s => s >= d && s <= addDays(d, 60));
      if (next && (!person || next < person.date)) person = { p: x, date: next };
    }
  }
  const when = s => { const n = daysBetween(d, s); return n === 0 ? t('day.today') : n === 1 ? t('day.tomorrow') : t('day.inDays', n); };
  // The running period in the tradition's own way of dividing the day.
  const kind = mKinds()[0], ch = (fine && { choghadiya: fine.choghadiya, gowri: fine.gowri, hora: fine.hora }[kind]) || [];
  const plabel = key => kind === 'hora' ? name('grahas', key) : name(kind, key);
  const i = ch.findIndex(c => now >= c.start && now < c.end);
  const chog = i < 0 ? null : [`${t('dm.' + kind)}: ${plabel(ch[i].key)}`, t('p.until', clock(ch[i].end)) + (ch[i + 1] ? ', ' + t('p.then', plabel(ch[i + 1].key)) : '')];
  const kept = Object.values(S.vratLog).filter(Boolean).length;
  const c = CULTURES.find(c => c.id === S.culture);
  // A lunar tradition's date already names the tithi; a solar one's does not.
  const tithi = p.tithis[0] ? `${pack.display.primary === 'solar' ? `${p.lunar ? name('paksha', p.lunar.paksha) + ' ' : ''}${name('tithis', p.tithis[0].key)} · ` : ''}${t('p.until', clock(p.tithis[0].end))}${p.tithis[1] ? ', ' + t('p.then', name('tithis', p.tithis[1].key)) : ''}` : '';
  const events = (pack.muhurtham?.events || []).slice(0, 3).map(e => e.names[lang()] ?? e.names.en);
  // The user may have moved to another tab while this loaded.
  if (tab !== 'home') return;
  const icon = k => ({
    festivals: '<path d="M12 3c1.8 2.2 2.6 3.9 2.6 5.3A2.6 2.6 0 0 1 12 11a2.6 2.6 0 0 1-2.6-2.7C9.4 6.9 10.2 5.2 12 3z"/><path d="M4 14h16c0 3.3-3.6 6-8 6s-8-2.7-8-6z"/><path d="M12 11v3"/>',
    day: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    vrats: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    jathakam: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 3.5l17 17M20.5 3.5l-17 17M12 3.5L20.5 12 12 20.5 3.5 12z"/>',
    sky: '<circle cx="12" cy="12" r="3.5"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-20 12 12)"/>',
    oldtime: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
    prayers: '<path d="M12 21V11M12 11c0-3 1.5-6 1.5-8M12 11c0-3-1.5-6-1.5-8"/><path d="M13.5 3l3.5 9-2 4-3 5M10.5 3L7 12l2 4 3 5"/>',
    temples: '<path d="M12 2.5v2M9.5 8h5l-1-3.5h-3zM8 12h8l-1.5-4h-5zM6 20.5h12V12H6z"/><path d="M10.5 20.5v-4a1.5 1.5 0 0 1 3 0v4M4 20.5h16"/>',
    people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9.5" r="2.3"/><path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5M15 14c3 0 5.5 1.8 5.5 5"/>',
    birthstar: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M17 3v4M15 5h4"/>',
    match: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    greetings: '<path d="M3.5 9.5 12 4l8.5 5.5V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/><path d="M3.5 9.5 12 15l8.5-5.5"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    muhurtham: '<circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="M10 4l2 3 2-3"/>',
  }[k]);
  const svg = k => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon(k)}</svg>`;
  // The symbol and the feature's name on one line, then what it holds now; the same symbol large and faint in the corner.
  const tile = (k, go, tone, label, value, detail) => `<button class="tile ${tone}" data-go="${go}" data-k="${k}" draggable="true"><span class="tbg" aria-hidden="true">${svg(k)}</span>
    <span class="trow"><span class="ic">${svg(k)}</span><span class="lb">${esc(label)}</span></span>
    <span class="tx"><b>${esc(value)}</b>${detail ? `<span class="dt">${esc(detail)}</span>` : ''}</span></button>`;
  const tiles = [
    tile('festivals', 'festivals', 'warm', t('tab.festivals'), fest ? fname(fest.f) : t('f.upcoming'), fest ? when(fest.date) : ''),
    tile('day', 'today', 'accent', t('dm.title'), chog ? chog[0] : t('time.section'), chog ? chog[1] : ''),
    tile('vrats', 'vrats', 'gold', t('vj.title'), vrat ? recName(vrat.key) : t('v.title'), vrat ? when(vrat.date) : kept ? t('vj.keptOf', String(kept)) : ''),
    tile('calendar', 'calendar', 'accent', t('tab.calendar'), greg(d, { month: 'long', year: 'numeric' }), yearLabel(p.year)),
    tile('jathakam', 'jathakam', 'accent', t('jk.chart'), t('jk.title'), [t('jk.vimshottari'), t('jk.yogini'), t('jk.chara')].join(' · ')),
    tile('sky', 'sky', 'gold', t('sk.title'), t('sk.now'), ''),
    PRAYERS ? (() => { const tp = todayPrayer(); return tile('prayers', 'prayers', 'gold', t('py.title'), tp ? prayerTitle(tp) : t('pr.today'), tp ? t('deity.' + tp.deity) : ''); })() : tile('prayers', 'prayers', 'gold', t('py.title'), t('pr.today'), ''),
    tile('oldtime', 'oldtime', 'quiet', t('ot.title'), timeUnitNames().map(x => x[0].toUpperCase() + x.slice(1)).join(' · '), t('ot.toTrad', timeUnitNames()[0])),
    tile('temples', 'temples', 'warm', t('tm.title'), t('tm.deity'), ['vishnu', 'shiva', 'devi'].map(x => t('deity.' + x)).join(' · ')),
    tile('people', 'people', 'accent', t('fam.family'), person ? t(person.p.kind === 'remembrance' ? 'pp.remembranceOf' : 'pp.birthdayOf', person.p.name) : t('pp.title'), person ? when(person.date) : t('pp.add')),
    ...(matchingAvailable() ? [tile('match', 'match', 'accent', t('mt.label'), matchTitle(), t(matchesByPorutham() ? 'mt.ten' : 'mt.eight'))] : []),
    tile('greetings', 'greetings', 'gold', t('gr.title'), greet ? t('gr.send', fname(greet.f)) : t('gr.card'), greet ? when(greet.date) : ''),
    tile('birthstar', 'birthstar', 'gold', t('bs.result'), t('bs.title'), ''),
    tile('settings', 'settings', 'quiet', t('tab.settings'), c ? (S.native ? c.native : c.en) : '', S.home?.name || ''),
  ];
  $('#main').innerHTML = `<div class="home">
    <div class="homehead"><div><div class="small muted"><b>${esc(greg(d))} · ${esc(cultureDate(p.solar, p.lunar))}</b></div><div class="serif wordmark">Eka Panchang</div>
      <div class="small"><b id="clocks">${esc(clocks())}</b></div><div class="small muted" id="nazhika">${esc(sinceSunrise(p.sunrise))}</div></div>
      <button class="placepill" data-go="settings">📍 ${esc(S.home.name)}</button></div>
    <div class="homehero">
      <button class="hero" data-go="today">
        <span class="heroart" aria-hidden="true">${PETALS}</span>
        <span class="herotop"><span>${esc(t('p.panchang'))}</span><span><span aria-hidden="true" class="moon">${moonPhase(p.tithis[0]?.index)}</span> <span class="dialbtn" role="button" tabindex="0" data-dial>◷ ${esc(t('dial.open'))}</span></span></span>
        <span class="serif herodate">${esc(cultureDate(p.solar, p.lunar))}</span>
        <span class="herosub">${esc(tithi)}</span>
        <span class="herosub small">${esc(yearLabel(p.year))}</span>
        ${p.tithis[0] ? (() => { const x = p.tithis.find(x => x.start <= now && now < x.end) || p.tithis[0], f = Math.min(1, Math.max(0, (now - x.start) / (x.end - x.start))); return `<span class="tprog"><span style="width:${Math.max(2, f * 100)}%"></span></span><span class="herosub small">${esc(t('hm.tithiDone', name('tithis', x.key), Math.round(f * 100)))}</span>`; })() : ''}
        <span class="skywrap">${skyStrip(p, S.home.tz)}</span>
        <span class="hcells">${[[t('p.nakshatra'), p.nakshatras[0] ? name('nakshatras', p.nakshatras[0].key) : '–'], [t('sun.moonrise'), p.moonrise ? clock(p.moonrise) : t('sun.none')], [t('sun.moonset'), p.moonset ? clock(p.moonset) : t('sun.none')]]
          .map(([l, v]) => `<span class="hcell"><span>${esc(l)}</span><b>${esc(v)}</b></span>`).join('')}</span>
        <span class="rahu">${esc(t('time.rahu'))} ${esc(span(p.rahuKalam))}</span>
      </button>
      <button class="wide" data-go="muhurtham"><span class="ic">${svg('muhurtham')}</span>
        <span class="tx"><span class="lb">${esc(t('tab.muhurtham'))}</span><span class="serif big">${esc(t('m.pwTitle'))}</span><span class="dt">${esc(events.join(', '))}…</span></span><span class="chev" aria-hidden="true">›</span></button>
    </div>
    <div class="arrangebar"><span class="tsize"><button data-ts="-1" aria-label="${esc(t('ts.smaller'))}">A−</button><button data-ts="1" aria-label="${esc(t('ts.larger'))}" style="font-size:17px">A+</button></span>
      <button class="linkbtn" data-arrange>▦ ${esc(t('hm.arrange'))}</button></div>
    <div class="tiles style-${esc(S.tileStyle)}">${orderTiles(tiles).join('')}</div>
    <div class="small muted" style="text-align:center;margin-top:8px">Eka Panchang · ${esc(t('o.tagline'))}</div></div>`;
  $('#main').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { tab = b.dataset.go; render(); scrollTo(0, 0); });
  animateSky($('#main').querySelector('svg.sky'));
  $('#main').querySelector('[data-dial]').onclick = e => { e.stopPropagation(); openDial(today()); };
  $('#main').querySelectorAll('[data-ts]').forEach(b => b.onclick = () => { S.textSize = Math.max(0, Math.min(TEXT_SIZES.length - 1, S.textSize + +b.dataset.ts)); save(); applyTextSize(); });
  $('#main').querySelector('[data-arrange]').onclick = () => arrangeSheet(tiles.map(x => x.match(/data-k="([^"]+)"/)[1]), { fest, greet, vrat, person, d });
  // Drag a tile onto another to put it there.
  let dragged = null;
  $('#main').querySelectorAll('.tile[data-k]').forEach(el => {
    el.ondragstart = e => { dragged = el.dataset.k; e.dataTransfer.effectAllowed = 'move'; };
    el.ondragover = e => e.preventDefault();
    el.ondrop = e => {
      e.preventDefault();
      if (!dragged || dragged === el.dataset.k) return;
      const order = [...$('#main').querySelectorAll('.tile[data-k]')].map(x => x.dataset.k).filter(k => k !== dragged);
      order.splice(order.indexOf(el.dataset.k), 0, dragged);
      S.tileOrder = order; save(); viewHome();
    };
  });
  clearInterval(homeTick);
  homeTick = setInterval(() => { if (tab !== 'home' || !$('#clocks')) return clearInterval(homeTick); $('#clocks').textContent = clocks(); $('#nazhika').textContent = sinceSunrise(p.sunrise); }, 30000);
  // The year's sky takes a few seconds; its tile fills in when ready, next year only if this one is over.
  const y = +d.slice(0, 4);
  let sky = (await skyEvents(y).catch(() => [])).find(e => e.at > now);
  if (!sky) sky = (await skyEvents(y + 1).catch(() => [])).find(e => e.at > now);
  const el = tab === 'home' && $('#main .tile[data-go="sky"] .tx');
  if (el && sky) el.innerHTML = `<b>${esc(skyTitle(sky))}</b><span class="dt">${esc(dtf({ day: 'numeric', month: 'short', year: 'numeric', timeZone: S.home.tz }).format(new Date(sky.at * 1000)))}</span>`;
}

// ---------------------------------------------------------------- today / day
async function viewDay() {
  const d = dayDate || today();
  loading();
  const p = await day(d, here());
  const fine = await engine({ op: 'timings', handle: await cal(+d.slice(0, 4), here()), date: d }).catch(() => null);
  const prev = dayPlace ? null : await day(addDays(d, -1)).catch(() => null);
  const parana = prev && prev.occurrences.some(o => o.id === 'ekadashi') ? await engine({ op: 'parana', handle: await cal(+addDays(d, -1).slice(0, 4)), date: addDays(d, -1) }) : null;
  const limb = (list, table) => {
    if (!list?.length) return ['–', ''];
    let detail = t('p.until', clock(list[0].end)); if (list[1]) detail += ' · ' + t('p.then', name(table, list[1].key));
    return [name(table, list[0].key), detail];
  };
  const [tv, td] = limb(p.tithis, 'tithis'), [nv, nd] = limb(p.nakshatras, 'nakshatras'), [yv, yd] = limb(p.yogas, 'yogas'), [kv, kd] = limb(p.karanas, 'karanas');
  const fests = p.occurrences.filter(o => !o.recurring).map(o => ({ o, f: pack.festivals.find(f => f.id === o.id) })).filter(x => x.f && !x.f.hidden);
  const recs = [...new Set(p.occurrences.filter(o => o.recurring && (!pack.dailySignificance.find(r => r.key === o.id)?.optIn || S.vrats.includes(o.id))).map(o => o.id))];
  const people = await peopleOn(d);
  const checkIns = d === today() && !dayPlace ? await vratCheckIns() : [];
  const skyToday = dayPlace ? [] : (await skyEvents(+d.slice(0, 4)).catch(() => [])).filter(e => new Intl.DateTimeFormat('en-CA', { timeZone: S.home.tz }).format(new Date(e.at * 1000)) === d);
  $('#main').innerHTML = `
    ${checkIns.slice(0, 3).map(checkInCard).join('')}
    <div class="dayhead"><div class="nav"><button class="arrow" data-shift="-1" aria-label="Previous day">‹</button>
      <div><h1 class="serif">${esc(cultureDate(p.solar, p.lunar))}</h1><div class="muted">${esc(greg(d))}</div><div class="small muted">${esc(yearLabel(p.year))}</div>
      <div class="small muted">📍 ${esc(t('f.forPlace', here().name))}</div></div>
      <button class="arrow" data-shift="1" aria-label="Next day">›</button></div>
      ${d !== today() ? `<button class="btn soft noprint" data-today>${esc(t('day.jumpToday'))}</button>` : ''}<button class="btn soft noprint" data-dialday>◷ ${esc(t('dial.open'))}</button></div>
    ${fests.length || recs.length || people.length || skyToday.length ? `<p class="label">${esc(t('day.observances'))}</p>` : ''}
    ${skyToday.map(e => `<div class="rec" data-goto-sky style="cursor:pointer">✦ ${esc(skyTitle(e))} · ${esc(clock(e.at))}</div>`).join('')}
    ${fests.map(({ f, o }) => `<div class="fest ${f.tier === 'major' ? 'major' : ''}" data-f="${esc(f.id)}" data-d="${o.date}"><div class="bar2"></div><div><b>${esc(fname(f))}</b><div class="small muted">${esc(fother(f))}</div><div class="small muted">${esc(text(f.content?.summary))}</div></div><div class="when">›</div></div>`).join('')}
    ${people.map(x => `<div class="rec">🎁 <b>${esc(x.title)}</b> <span class="small muted">${esc(x.line)}</span></div>`).join('')}
    ${recs.map(k => { const r = pack.dailySignificance.find(r => r.key === k); return `<div class="rec">🌙 <b>${esc(recName(k))}</b>${/sank/.test(k) && p.moonrise ? ` <span class="small" style="color:var(--accent);font-weight:700">· ${esc(t('sun.moonrise'))} ${esc(clock(p.moonrise))}</span>` : ''}<div class="small muted">${esc(text(r?.content?.summary))}</div></div>`; }).join('')}
    ${parana ? `<div class="card"><p class="label">${esc(t('v.parana'))}</p><div style="font-size:20px;font-weight:700">${esc(span(parana))}</div>${parana.dvadashiEnd ? `<div class="small muted">${esc(t('v.dvadashiEnds', clock(parana.dvadashiEnd)))}</div>` : ''}<div class="small muted">${esc(t('v.paranaWhy'))}</div></div>` : ''}
    <div class="card"><p class="label">${esc(t('p.panchang'))}</p>
      ${[[t('p.tithi'), (p.lunar ? name('paksha', p.lunar.paksha) + ' ' : '') + tv, td], [t('p.nakshatra'), nv, nd], [t('p.yoga'), yv, yd], [t('p.karana'), kv, kd]]
        .map(([l, v, s]) => `<div class="row"><span class="muted">${esc(l)}</span><span class="v">${esc(v)}<small>${esc(s)}</small></span></div>`).join('')}</div>
    ${fine && starPerson() ? starCard(starPerson(), p, fine, d) : ''}
    ${fine ? dayDetail(p, fine, d) : ''}
    <div class="card sun">${[['sun.sunrise', p.sunrise], ['sun.sunset', p.sunset], ['sun.moonrise', p.moonrise], ['sun.moonset', p.moonset]]
        .map(([k, u]) => `<div><b>${u ? esc(clock(u)) : esc(t('sun.none'))}</b><span class="small muted">${esc(t(k))}</span></div>`).join('')}</div>
    <div class="card"><p class="label">${esc(t('time.section'))}</p><div class="small muted">${esc(t('time.avoid'))}</div>
      ${[['time.rahu', p.rahuKalam], ['time.yama', p.yamagandam], ['time.gulika', p.gulikaKalam]].map(([k, w]) => `<div class="row"><span>${esc(t(k))}</span><span class="v">${esc(span(w))}</span></div>`).join('')}
      ${fine ? [['time.durmuhurtam', fine.durmuhurtam], ['time.varjyam', fine.varjyam], ['time.bhadra', fine.bhadra], ['time.panchaka', fine.panchaka]].map(([k, ps]) => windowsRow(k, ps, d)).join('') : ''}
      <div class="small muted" style="margin-top:8px">${esc(t('time.favoured'))}</div>
      <div class="row"><span>${esc(t('time.abhijit'))}</span><span class="v">${esc(p.weekday === 'wednesday' ? t('time.abhijitNone') : span(p.abhijit))}</span></div>
      ${fine ? windowsRow('time.amrit', fine.amritKalam, d) : ''}
      ${[['time.brahma', p.brahmaMuhurta]].map(([k, w]) => `<div class="row"><span>${esc(t(k))}</span><span class="v">${esc(span(w))}</span></div>`).join('')}</div>
    ${fine ? `<div class="card" id="mcard">${muhurtasCard(fine, d)}</div>` : ''}
    <button class="btn soft block noprint" onclick="window.print()">${SHARE_ICON} ${esc(t('pdf.share'))}</button>`;
  $('#main').querySelector('[data-dialday]')?.addEventListener('click', () => openDial(d));
  $('#main').querySelectorAll('[data-shift]').forEach(b => b.onclick = () => { dayDate = addDays(d, +b.dataset.shift); tab = 'today'; viewDay(); });
  $('#main').querySelector('[data-today]')?.addEventListener('click', () => { dayDate = null; viewDay(); });
  wireCheckIns();
  $('#main').querySelectorAll('[data-goto-sky]').forEach(x => x.onclick = () => { tab = 'sky'; render(); });
  wireMuhurtas(fine, d);
  wireFestivals();
}

// As on iOS (DayDetailCard): collapsed by default - signs, the yogas of the
// day, the day's other muhurtas and the year in several reckonings.
function dayDetail(p, f, d) {
  const spans = (ps, label) => ps.map((x, i) => i < ps.length - 1 ? `${label(x.key)} ${t('p.until', clock(x.end))}` : label(x.key)).join('<br>');
  const wins = ps => ps.length ? ps.map(x => esc(windowText(x.start, x.end, d))).join('<br>') : esc(t('dd.none'));
  const row = (k, v) => `<div class="row"><span class="muted">${esc(t(k))}</span><span class="v">${v}</span></div>`;
  const years = (p.years || []).map(y => {
    const era = name('eras', y.era), sv = y.samvatsara && pack.names?.samvatsaras?.[y.samvatsara] ? name('samvatsaras', y.samvatsara) : '';
    return y.number != null ? `${era} ${y.number}${sv ? ' · ' + sv : ''}` : `${sv} · ${era}`;
  });
  return `<details class="card detail"><summary class="label">${esc(t('dd.title'))}</summary>
    ${row('dd.moonSign', esc(spans(f.moonSigns, k => name('rashis', k))).replace(/&lt;br&gt;/g, '<br>'))}
    ${row('dd.sunSign', esc(spans(f.sunSigns, k => name('rashis', k))).replace(/&lt;br&gt;/g, '<br>'))}
    ${row('dd.anandadi', esc(spans(f.anandadi, k => name('anandadi', k))).replace(/&lt;br&gt;/g, '<br>'))}
    ${row('dd.sarvartha', wins(f.sarvarthaSiddhi))}${row('dd.amritSiddhi', wins(f.amritSiddhi))}
    ${[['dd.pratah', f.pratahSandhya], ['dd.vijaya', f.vijaya], ['dd.godhuli', f.godhuli], ['dd.sayahna', f.sayahnaSandhya], ['dd.nishita', f.nishita]].map(([k, w]) => row(k, esc(windowText(w.start, w.end, d)))).join('')}
    ${row('dd.years', years.map(esc).join('<br>'))}</details>`;
}

// ---------------------------------------------------------------- the day in parts
// As on iOS (MuhurtasCard): Choghadiya, Gowri, Hora or the lagna table, the
// tradition's own first; the current and next periods, the rest on request.
const FAVOURED = new Set(['amrita', 'shubha', 'labha', 'chara', 'amirdha', 'uthi', 'laabam', 'dhanam', 'sugam']);
let mAll = false;
function civilIn(u) { return new Intl.DateTimeFormat('en-CA', { timeZone: here().tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(u * 1000)); }
function stamp(u, d) {
  if (civilIn(u) === d) return clock(u);
  return dtf({ day: 'numeric', month: 'short', timeZone: here().tz }).format(new Date(u * 1000)) + ' ' + clock(u);
}
function windowText(a, b, d) { return civilIn(a) === civilIn(b) ? `${stamp(a, d)} – ${clock(b)}` : `${stamp(a, d)} – ${stamp(b, d)}`; }
function windowsRow(k, ps, d) {
  return ps.length ? `<div class="row"><span>${esc(t(k))}</span><span class="v">${ps.map(p => esc(windowText(p.start, p.end, d))).join('<br>')}</span></div>` : '';
}
// As on iOS (dayPartKinds): the tradition's own ways of dividing the day, its own first.
function mKinds() {
  if (['tamil', 'sri-lankan-tamil', 'malaysian-tamil', 'south-african-tamil', 'telugu'].includes(S.culture)) return ['gowri', 'hora', 'lagna'];
  if (['malayalam', 'kannada'].includes(S.culture)) return ['hora', 'lagna'];
  return ['choghadiya', 'hora', 'lagna'];
}
function mKind() {
  return mKinds().includes(S.mKind) ? S.mKind : mKinds()[0];
}
function muhurtasCard(fine, d) {
  const k = mKind(), ps = { choghadiya: fine.choghadiya, gowri: fine.gowri, hora: fine.hora, lagna: fine.lagnas }[k];
  const label = key => k === 'hora' ? name('grahas', key) : k === 'lagna' ? name('rashis', key) : name(k, key);
  const now = Date.now() / 1000, cur = ps.findIndex(p => now >= p.start && now < p.end);
  const from = mAll ? 0 : Math.max(cur, 0), list = ps.slice(from, mAll ? ps.length : from + 3);
  // The favoured period now, or the next one and how soon.
  const fav = (k === 'choghadiya' || k === 'gowri') ? ps.find(p => FAVOURED.has(p.key) && p.end > now) : null;
  const mins = fav ? Math.floor((fav.start - now) / 60) : 0;
  const good = !fav ? '' : fav.start <= now ? t('dm.goodNow', label(fav.key), windowText(fav.start, fav.end, d))
    : t('dm.goodNext', label(fav.key), windowText(fav.start, fav.end, d), mins >= 60 ? t('dm.inHM', Math.floor(mins / 60), mins % 60) : t('dm.inM', mins));
  return `<p class="label">${esc(t('dm.title'))}</p>
    <div class="seg" style="margin-bottom:8px">${mKinds().map(x => `<button data-mk="${x}" class="${k === x ? 'on' : ''}">${esc(t('dm.' + x))}</button>`).join('')}</div>
    ${good ? `<div style="color:var(--accent);font-weight:700;margin:4px 0 6px">✦ ${esc(good)}</div>` : ''}
    ${list.map((p, j) => { const i = from + j, marked = k === 'choghadiya' || k === 'gowri';
      const night = mAll && i > 0 && p.night && !ps[i - 1].night ? `<div class="small muted" style="margin-top:6px;font-weight:700">${esc(t('dm.night'))}</div>` : '';
      return `${night}<div class="mrow ${i === cur ? 'now' : ''}"><span class="mdot ${marked ? (FAVOURED.has(p.key) ? 'fav' : 'ring') : ''}"></span><span class="grow">${esc(label(p.key))}${i === cur ? ` <b class="small">${esc(t('dm.now'))}</b>` : ''}</span><span class="muted">${esc(windowText(p.start, p.end, d))}</span></div>`; }).join('')}
    <button class="linkbtn" data-mall>${mAll ? '⌃ ' + esc(t('c.done')) : '⌄ ' + esc(t('f.all'))}</button>`;
}
function wireMuhurtas(fine, d) {
  const c = $('#mcard'); if (!c) return;
  c.querySelectorAll('[data-mk]').forEach(b => b.onclick = () => { S.mKind = b.dataset.mk; save(); c.innerHTML = muhurtasCard(fine, d); wireMuhurtas(fine, d); });
  c.querySelector('[data-mall]').onclick = () => { mAll = !mAll; c.innerHTML = muhurtasCard(fine, d); wireMuhurtas(fine, d); };
}
function wireFestivals(root = $('#main')) {
  root.querySelectorAll('[data-f]').forEach(el => el.onclick = () => festivalSheet(el.dataset.f, el.dataset.d));
}

// ---------------------------------------------------------------- vrat journal
// As on iOS (Core/VratJournal.swift): after each vrat the user keeps, Kaal
// asks how it went, and every one kept adds a star.
async function vratDays(from, to) {
  if (!S.vrats.length) return [];
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const p = await day(d).catch(() => null);
    for (const k of [...new Set((p?.occurrences || []).filter(o => o.recurring && S.vrats.includes(o.id)).map(o => o.id))].sort()) out.push({ key: k, date: d, id: `${k}|${d}` });
  }
  return out;
}
// When a vrat is over: the Ekadashi at its parana, a Sankashti after moonrise,
// a Pradosh after the evening worship, night vrats at the next sunrise, the rest an hour after sunset.
async function vratCloses(v) {
  const k = v.key;
  if (k.includes('ekadashi')) {
    const p = await engine({ op: 'parana', handle: await cal(+v.date.slice(0, 4)), date: v.date }).catch(() => null);
    if (p) return p.start;
  }
  const d = await day(v.date).catch(() => null); if (!d) return null;
  if (k.includes('ekadashi') || k.includes('shivaratri') || k === 'kalashtami' || k === 'theipirai-ashtami') return d.nextSunrise + 1800;
  if (k.startsWith('sank') && d.moonrise && d.moonrise > d.sunset) return d.moonrise + 1800;
  if (k.startsWith('pradosh')) return d.sunset + 9000;
  return d.sunset + 3600;
}
async function vratCheckIns() {
  const now = Date.now() / 1000, out = [];
  for (const v of await vratDays(addDays(today(), -7), today())) {
    if (S.vratLog[v.id] !== undefined) continue;
    const c = await vratCloses(v); if (c && c <= now) out.push(v);
  }
  return out;
}
const vratsKept = (key, year) => Object.entries(S.vratLog).filter(([id, kept]) => kept && (!key || id.split('|')[0] === key) && (!year || id.split('|')[1].startsWith(year))).length;
function vratRun(key) {
  let n = 0;
  for (const [, kept] of Object.entries(S.vratLog).filter(([id]) => id.startsWith(key + '|')).sort((a, b) => a[0] < b[0] ? 1 : -1)) { if (!kept) break; n++; }
  return n;
}
function answerVrat(id, kept) {
  if (kept === null) delete S.vratLog[id]; else S.vratLog[id] = kept;
  save();
  if (kept) { const key = id.split('|')[0]; celebrate(key, vratsKept(key), vratRun(key), vratsKept(key, today().slice(0, 4))); }
}
function checkInCard(v) {
  const r = pack.dailySignificance.find(r => r.key === v.key);
  const steps = r?.content?.howTo ? (r.content.howTo[lang()] ?? r.content.howTo.en ?? []) : [];
  return `<div class="card checkin" data-vrat="${esc(v.id)}"><div><b>🌙 ${esc(t('vj.ask', recName(v.key)))}</b>
    ${v.date !== today() ? `<div class="small muted">${esc(greg(v.date, { day: 'numeric', month: 'short', year: 'numeric' }))}</div>` : ''}</div>
    ${steps.length ? `<details><summary class="small">${esc(t('vj.rules'))}</summary><ul class="small">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ul></details>` : ''}
    <div class="answers"><button class="btn" data-kept="1">★ ${esc(t('vj.kept'))}</button><button class="btn soft" data-kept="0">${esc(t('vj.notThisTime'))}</button></div></div>`;
}
function wireCheckIns(root = $('#main')) {
  root.querySelectorAll('.checkin [data-kept]').forEach(b => b.onclick = () => {
    const card = b.closest('.checkin'), kept = b.dataset.kept === '1';
    answerVrat(card.dataset.vrat, kept);
    if (kept) card.remove();
    else {
      // The kind line for a moment, then the card goes, as it does when kept.
      card.querySelector('.answers').outerHTML = `<div class="small muted">${esc(t('vj.gentle'))}</div>`;
      setTimeout(() => { card.classList.add('leaving'); setTimeout(() => card.remove(), 300); }, 2000);
    }
  });
}
function celebrate(key, count, run, year) {
  const o = document.createElement('div'); o.className = 'celebrate';
  const sparks = Array.from({ length: 12 }, (_, i) => `<i style="--a:${i * 30}deg;--c:${i % 3 ? 'var(--gold)' : 'var(--accent)'}">★</i>`).join('');
  o.innerHTML = `<div class="cel-card" role="dialog" aria-modal="true"><div class="cel-star">${sparks}<span>★</span></div>
    <h2 class="serif">${esc(t('vj.done'))}</h2><div class="cel-count">${Math.max(0, count - 10)}</div>
    <div><b>${esc(t('vj.keptOf', recName(key)))}</b></div>
    <div class="cel-pills">${run > 1 ? `<span class="pill">🔥 ${esc(t('vj.run', run))}</span>` : ''}<span class="pill">📅 ${esc(t('vj.year', year))}</span></div>
    <button class="btn">${esc(t('c.done'))}</button></div>`;
  const close = () => { o.classList.add('out'); setTimeout(() => o.remove(), 220); };
  o.onclick = e => { if (e.target === o || e.target.tagName === 'BUTTON') close(); };
  document.body.appendChild(o);
  const n = o.querySelector('.cel-count'); let i = +n.textContent;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = () => { if (i < count) { n.textContent = ++i; setTimeout(tick, still ? 0 : 90); } };
  setTimeout(tick, still ? 0 : 400);
}
// The vrat calendar: a star on each day kept, a moon where it was not this
// time, a dashed ring where it is unanswered.
let vcMonth = null, vcFilter = null;
async function vratCalendar() {
  const m = vcMonth || today().slice(0, 8) + '01';
  const [y, mo] = m.split('-').map(Number);
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const last = `${y}-${pad(mo)}-${pad(dim)}`;
  const entries = await vratDays(m, last < today() ? last : today());
  for (const id of Object.keys(S.vratLog)) {
    const [key, date] = id.split('|');
    if (date.startsWith(m.slice(0, 7)) && !entries.some(e => e.id === id)) entries.push({ key, date, id });
  }
  entries.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const shown = entries.filter(e => !vcFilter || e.key === vcFilter);
  const keys = [...new Set([...S.vrats, ...Object.keys(S.vratLog).map(id => id.split('|')[0])])];
  const wd = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(k => {
    const n = name('weekdays', k); if (lang() === 'en') return n.slice(0, 3);
    for (const x of ['వారం', 'ವಾರ', 'वार', 'கிழமை', 'ആഴ്ച', 'વાર', 'বার', 'ବାର']) if (n.endsWith(x) && n.length > x.length) return n.slice(0, -x.length);
    return n;
  });
  let cells = '<div class="vc"></div>'.repeat(parse(m).getUTCDay());
  for (let n = 1; n <= dim; n++) {
    const d = `${y}-${pad(mo)}-${pad(n)}`, here = shown.filter(e => e.date === d).map(e => S.vratLog[e.id]);
    const kept = here.includes(true);
    cells += `<div class="vc ${kept ? 'kept' : here.length ? 'vrat' : ''} ${d === today() ? 'today' : ''}"><b>${n}</b><span>${kept ? '<span class="gold">★</span>' : here.includes(false) ? '☾' : here.length ? '◌' : ''}</span></div>`;
  }
  const mark = a => a === true ? '<span class="gold">★</span>' : a === false ? '☾' : '◌';
  return `<div class="card"><p class="label">${esc(t('vj.calendar'))}</p>
    <div class="dayhead" style="margin:0"><div class="nav"><button class="arrow" data-vc="-1">‹</button><b class="serif" style="font-size:20px">${esc(dtf({ month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(m)))}</b><button class="arrow" data-vc="1">›</button></div></div>
    ${keys.length > 1 ? `<div class="vc-chips"><button class="pill ${!vcFilter ? 'on' : ''}" data-vf="">${esc(t('f.all'))}</button>${keys.map(k => `<button class="pill ${vcFilter === k ? 'on' : ''}" data-vf="${esc(k)}">${esc(recName(k))}</button>`).join('')}</div>` : ''}
    <div class="grid">${wd.map(w => `<div class="wd">${esc(w)}</div>`).join('')}${cells}</div>
    <p class="gold" style="font-weight:700">★ ${esc(t('vj.monthKept', shown.filter(e => S.vratLog[e.id] === true).length))}</p>
    ${shown.map(e => `<div class="list-row"><div class="grow">${esc(recName(e.key))}<div class="small muted">${esc(greg(e.date, { day: 'numeric', month: 'short', year: 'numeric' }))}</div></div><span style="font-size:20px">${mark(S.vratLog[e.id])}</span></div>`).join('')}</div>`;
}

async function viewVrats() {
  loading();
  const choices = pack.dailySignificance.filter((r, i, a) => a.findIndex(x => x.key === r.key) === i);
  const recent = [];
  for (const v of await vratDays(addDays(today(), -30), today())) { const c = await vratCloses(v); if (c && c <= Date.now() / 1000) recent.push(v); }
  const icon = a => a === true ? '<span class="gold">★</span>' : a === false ? '☾' : '◌';
  $('#main').innerHTML = `<div class="card"><p class="label">${esc(t('vj.title'))}</p>
      ${S.vrats.length ? `<div class="journal-head"><span class="gold big">★</span><div><div class="big">${vratsKept()}</div><div class="small muted">${esc(t('vj.total'))}</div></div>
        <div class="small muted" style="margin-left:auto">${esc(t('vj.year', vratsKept(null, today().slice(0, 4))))}</div></div>
        ${S.vrats.filter(k => vratsKept(k)).map(k => `<div class="row"><span>${esc(recName(k))}</span><span class="v">${vratRun(k) > 1 ? `<small style="display:inline">${esc(t('vj.run', vratRun(k)))} · </small>` : ''}<span class="gold">★ ${vratsKept(k)}</span></span></div>`).join('')}
        <p class="small muted">${esc(t('vj.askBody'))}</p>` : `<p class="small muted">${esc(t('vj.empty'))}</p>`}</div>
    ${recent.length ? `<div class="card"><p class="label">${esc(t('vj.recent'))}</p>${recent.reverse().map(v => `<div class="list-row"><div class="grow">${esc(recName(v.key))}<div class="small muted">${esc(greg(v.date, { day: 'numeric', month: 'short', year: 'numeric' }))}</div></div>
        <button class="btn soft" data-mark="${esc(v.id)}" data-to="1" title="${esc(t('vj.kept'))}">★</button><button class="btn soft" data-mark="${esc(v.id)}" data-to="0" title="${esc(t('vj.notThisTime'))}">☾</button>
        <span style="width:28px;text-align:center;font-size:20px">${icon(S.vratLog[v.id])}</span></div>`).join('')}<p class="small muted">${esc(t('vj.recentNote'))}</p></div>` : ''}
    ${await vratCalendar()}
    <div class="card"><p class="label">${esc(t('vg.list'))}</p>${choices.map(r => `<details class="factor"><summary><span class="grow"><b>${esc(recName(r.key))}</b><span class="small muted" style="display:block">${esc(text(r.content?.summary))}</span></span></summary>
        ${r.content?.traditions ? `<p class="label" style="margin:10px 0 2px">${esc(t('vg.title'))}</p><p style="margin:0">${esc(text(r.content.traditions))}</p>` : ''}
        ${(r.content?.howTo?.[lang()] || r.content?.howTo?.en || []).length ? `<p class="label" style="margin:10px 0 2px">${esc(t('vg.steps'))}</p><ol style="margin:0;padding-left:20px">${(r.content.howTo[lang()] || r.content.howTo.en).map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
        <p class="small muted">${esc(t('vg.gentle'))}</p></details>`).join('')}</div>
    <div class="card"><p class="label">${esc(t('v.title'))}</p>${choices.map(r => `<label class="list-row" style="cursor:pointer"><div class="grow"><b>${esc(recName(r.key))}</b><div class="small muted">${esc(text(r.content?.summary))}</div></div>
        <input type="checkbox" data-v="${esc(r.key)}" ${S.vrats.includes(r.key) ? 'checked' : ''}></label>`).join('')}<p class="small muted">${esc(t('v.note'))}</p></div>`;
  $('#main').querySelectorAll('[data-v]').forEach(c => c.onchange = () => {
    S.vrats = S.vrats.filter(k => k !== c.dataset.v); if (c.checked) S.vrats.push(c.dataset.v); save(); viewVrats();
  });
  $('#main').querySelectorAll('[data-mark]').forEach(b => b.onclick = () => { answerVrat(b.dataset.mark, b.dataset.to === '1'); viewVrats(); });
  $('#main').querySelectorAll('[data-vc]').forEach(b => b.onclick = () => {
    const d = parse(vcMonth || today().slice(0, 8) + '01'); d.setUTCMonth(d.getUTCMonth() + +b.dataset.vc, 1); vcMonth = ymd(d); viewVrats();
  });
  $('#main').querySelectorAll('[data-vf]').forEach(b => b.onclick = () => { vcFilter = b.dataset.vf || null; viewVrats(); });
}

// ---------------------------------------------------------------- families
// As on iOS (Core/Personal.swift): people kept in families, each with a relation.
const RELATIONS = ['self', 'wife', 'husband', 'son', 'daughter', 'father', 'mother', 'brother', 'sister', 'grandfather', 'grandmother', 'grandson',
  'granddaughter', 'fatherInLaw', 'motherInLaw', 'sonInLaw', 'daughterInLaw', 'uncle', 'aunt', 'nephew', 'niece', 'cousin', 'other'];
function relationSex(r) {
  if (['wife', 'daughter', 'mother', 'sister', 'grandmother', 'granddaughter', 'motherInLaw', 'daughterInLaw', 'aunt', 'niece'].includes(r)) return 'female';
  if (['husband', 'son', 'father', 'brother', 'grandfather', 'grandson', 'fatherInLaw', 'sonInLaw', 'uncle', 'nephew'].includes(r)) return 'male';
  return null;
}
function defaultFamily() {
  if (!S.families.length) { S.families.push({ id: crypto.randomUUID(), name: t('fam.default') }); save(); }
  return S.families[0];
}
function adoptFamilyless() {
  if (!S.people.some(p => !p.family)) return;
  const f = defaultFamily(); S.people.forEach(p => { p.family ||= f.id; }); save();
}
const personLabel = p => p.relation ? `${p.name} · ${t('rel.' + p.relation)}` : p.name;
let jkFamily = null;
// Choose people from any family for the dasha sandhis, as on iOS (PeoplePicker).
function peoplePicker(ps) {
  const pick = new Set(S.sandhiPick || []);
  const groups = [...S.families.map(f => [f.name, ps.filter(p => p.family === f.id)]), [t('fam.default'), ps.filter(p => !S.families.some(f => f.id === p.family))]].filter(([, l]) => l.length);
  const o = sheet(`<h2 class="serif">${esc(t('fg.choose'))}</h2>${groups.map(([n, l]) => `<p class="label">${esc(n)}</p><div class="card">${l.map(p => `<label class="list-row"><input type="checkbox" data-pp="${p.id}" ${pick.has(p.id) ? 'checked' : ''}><span class="grow">${esc(personLabel(p))}</span></label>`).join('')}</div>`).join('')}
    <button class="btn block" data-ok>${esc(t('c.done'))}</button>`);
  o.querySelector('[data-ok]').onclick = () => {
    S.sandhiPick = [...o.querySelectorAll('[data-pp]:checked')].map(x => x.dataset.pp); save();
    jkFamily = S.sandhiPick.length ? 'pick' : null; o.remove(); viewJathakam();
  };
}
// Make, rename and remove families, and say who belongs to each, as on iOS (FamiliesManager).
function familiesManager() {
  defaultFamily();
  const o = sheet('<div id="fm"></div>');
  const draw = () => {
    const ps = S.people.filter(p => p.anchor);
    o.querySelector('#fm').innerHTML = `<h2 class="serif">${esc(t('fg.manage'))}</h2>${S.families.map(f => `<div class="card"><div style="display:flex;align-items:center;gap:8px"><b class="grow">${esc(f.name)}</b>
        <button class="linkbtn" data-rn="${f.id}" style="padding:0">${esc(t('fg.rename'))}</button>${S.families.length > 1 ? `<button class="linkbtn" data-rm="${f.id}" style="padding:0">🗑</button>` : ''}</div>
        ${ps.map(p => `<label class="list-row"><input type="checkbox" data-in="${f.id}|${p.id}" ${p.family === f.id ? 'checked disabled' : ''}><span class="grow">${esc(p.name)}</span>${p.family !== f.id ? `<span class="small muted">${esc(S.families.find(x => x.id === p.family)?.name || '')}</span>` : ''}</label>`).join('')}</div>`).join('')}
      <button class="btn soft block" data-new>＋ ${esc(t('fam.new'))}</button><p class="small muted">${esc(t('fg.note'))}</p><button class="btn block" data-ok>${esc(t('c.done'))}</button>`;
    o.querySelectorAll('[data-in]').forEach(c => c.onchange = () => { const [f, id] = c.dataset.in.split('|'); const p = S.people.find(x => x.id === id); if (p) p.family = f; save(); draw(); });
    o.querySelectorAll('[data-rn]').forEach(b => b.onclick = () => { const f = S.families.find(x => x.id === b.dataset.rn); const n = prompt(t('fam.name'), f.name)?.trim(); if (n) { f.name = n; save(); draw(); } });
    o.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const id = b.dataset.rm, other = S.families.find(x => x.id !== id); S.people.forEach(p => { if (p.family === id) p.family = other.id; }); S.families = S.families.filter(x => x.id !== id); if (jkFamily === id) jkFamily = null; save(); draw(); });
    o.querySelector('[data-new]').onclick = () => { const n = prompt(t('fam.name'))?.trim(); if (n) { S.families.push({ id: crypto.randomUUID(), name: n }); save(); draw(); } };
    o.querySelector('[data-ok]').onclick = () => { o.remove(); viewJathakam(); };
  };
  draw();
}

// ---------------------------------------------------------------- jathakam
// As on iOS (Views/JatakamViews.swift): the chart and its vargas in South,
// North or East Indian style, three dasha systems, and the family's dasha
// sandhis. Charts only, no reading.
let jkSection = 0, jkPerson = null, jkVarga = 1, jkSystem = 'vimshottari', jkAhead = true, jkSpan = 20;
const jkCache = new Map();
const births = () => S.people.filter(p => p.kind !== 'remembrance' && p.place);
// As on iOS (GunaMilanViews): each tradition's own matching - Porutham in the
// South, Ashtakoota Guna Milan elsewhere. Guna Milan stays off until the corpus
// (content/validation/ashtakoota-corpus.md) agrees with the reference almanac; ?gm=1 shows it for checking.
const GUNA_MILAN_RELEASED = true;
const matchesByPorutham = () => PORUTHAM.includes(S.culture);
async function gunaMilanSheet(bride, groom) {
  const side = p => ({ date: p.date, minutes: p.minutes ?? undefined, location: p.place });
  const r = await engine({ op: 'gunaMilan', bride: side(bride), groom: side(groom) });
  const m = r.milan, pts = x => Number.isInteger(x) ? String(x) : x.toFixed(1);
  const sideName = (k, v) => k.key === 'bhakoot' ? name('rashis', v) : k.key === 'graha-maitri' ? name('grahas', v) : v.charAt(0).toUpperCase() + v.slice(1);
  const rule = (key, of) => `<div class="card" style="background:var(--sunken)"><p class="small">${esc(t(key))}</p><p class="small muted"><b>${esc(t('gm.cancel'))}</b></p>
    ${m.cancellations.filter(c => c.of === of).map(c => `<div class="small" style="color:${c.holds ? 'var(--accent)' : 'var(--muted)'}">· ${esc(t('gm.c.' + c.condition))}: ${esc(t(c.holds ? 'gm.holds' : 'gm.notHold'))}</div>`).join('')}</div>`;
  const kuja = (p, list) => `<div class="small"><b>${esc(p.name)} · ${esc(t('gm.marsCount', list.filter(k => k.listed).length, list.length))}</b>${list.map(k => `<div style="color:${k.listed ? 'var(--accent)' : 'var(--muted)'}">${esc(t('jk.kujaRow', k.house, k.from === 'lagna' ? t('jk.lagnaWord') : name('grahas', k.from)))} · ${esc(t(k.listed ? 'mt.marsListed' : 'jk.kujaNot'))}</div>`).join('')}</div>`;
  sheet(`<h2 class="serif">${esc(t('gm.title'))}</h2><div style="font-size:24px;font-weight:700;color:var(--accent)">${esc(t('gm.total', pts(m.total)))}</div>
    <p style="font-weight:600">${esc(t('gm.band.' + m.band))}</p>
    <div class="card">${m.kootas.map(k => `<div class="row"><span>${esc(t('gm.' + k.key))}<small class="muted" style="display:block">${esc(t('gm.sides', sideName(k, k.bride), sideName(k, k.groom)))}</small></span><span class="v">${pts(k.points)} / ${pts(k.max)}</span></div>`).join('')}</div>
    ${m.nadiZero ? rule('gm.nadiRule', 'nadi') : ''}${m.bhakootZero ? rule('gm.bhakootRule', 'bhakoot') : ''}
    <div class="card"><p class="label">${esc(t('mt.mangalTitle'))}</p>${kuja(bride, r.brideKuja)}${kuja(groom, r.groomKuja)}</div>
    <p class="small muted">${esc(t('gm.note'))}</p>`);
}

async function jataka(p) {
  const key = `${p.id}|${p.date}|${p.minutes}|${p.place.latitude}`;
  if (!jkCache.has(key)) jkCache.set(key, engine({ op: 'jataka', date: p.date, minutes: p.minutes ?? undefined, location: p.place }));
  return jkCache.get(key);
}
const SIGNS = ['mesha', 'vrishabha', 'mithuna', 'karka', 'simha', 'kanya', 'tula', 'vrishchika', 'dhanu', 'makara', 'kumbha', 'meena'];
const GCOL = { sun: '#E08A2E', moon: '#8FA7C4', mars: '#C6453A', mercury: '#3E9B5C', jupiter: '#E2B53A', venus: '#D58AB4', saturn: '#3D4F8F', rahu: '#6E6A63', ketu: '#9A6B45' };
const chartStyle = () => S.chartStyle || ({ tamil: 'south', 'sri-lankan-tamil': 'south', 'malaysian-tamil': 'south', 'south-african-tamil': 'south', malayalam: 'south', telugu: 'south', kannada: 'south', bengali: 'east', odia: 'east' }[S.culture] || 'north');
const vargaName = n => `D${n} · ${name('vargas', 'd' + n)}`;
const dLabel = u => dtf({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(u * 1000));
function periodName(p, system) {
  if (system === 'yogini') return `${name('yoginis', p.key)} · ${name('grahas', p.lord)}`;
  if (system === 'chara') return name('rashis', p.key);
  return name('grahas', p.key);
}
function chartSvg(style, lagna, first, placements, retro, title) {
  const W = 100, lines = [], spots = [];
  const L = (a, b, c, d) => lines.push(`<line x1="${a * W}" y1="${b * W}" x2="${c * W}" y2="${d * W}"/>`);
  if (style === 'south') { for (const f of [0.25, 0.75]) { L(f, 0, f, 1); L(0, f, 1, f); } L(0.5, 0, 0.5, 0.25); L(0.5, 0.75, 0.5, 1); L(0, 0.5, 0.25, 0.5); L(0.75, 0.5, 1, 0.5); }
  if (style === 'north') { L(0, 0, 1, 1); L(1, 0, 0, 1); L(0.5, 0, 1, 0.5); L(1, 0.5, 0.5, 1); L(0.5, 1, 0, 0.5); L(0, 0.5, 0.5, 0); }
  if (style === 'east') { const a = 1 / 3, b = 2 / 3; L(a, 0, a, 1); L(b, 0, b, 1); L(0, a, 1, a); L(0, b, 1, b); L(0, 0, a, a); L(1, 0, b, a); L(0, 1, a, b); L(1, 1, b, b); }
  const cellS = [[0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1], [3, 0], [2, 0], [1, 0], [0, 0]];
  const N = [[.5, .25], [.25, .1], [.1, .25], [.25, .5], [.1, .75], [.25, .9], [.5, .75], [.75, .9], [.9, .75], [.75, .5], [.9, .25], [.75, .1]];
  const E = [[.5, .167], [.222, .111], [.111, .222], [.167, .5], [.111, .778], [.222, .889], [.5, .833], [.778, .889], [.889, .778], [.833, .5], [.889, .222], [.778, .111]];
  for (let i = 0; i < 12; i++) {
    const sign = style === 'north' ? SIGNS[(SIGNS.indexOf(first) + i) % 12] : SIGNS[i];
    const items = placements.filter(([, sg]) => sg === sign).map(([g]) => esc(name('grahaShort', g)) + (retro.has(g) ? 'ᴿ' : ''));
    if (lagna === sign) items.unshift(`<b class="as">${esc(name('grahaShort', 'lagna'))}</b>`);
    let x, y, w;
    if (style === 'south') { const [r, c] = cellS[i]; x = (c + .5) / 4; y = (r + .5) / 4; w = .23; }
    else if (style === 'north') { [x, y] = N[i]; w = [0, 3, 6, 9].includes(i) ? .24 : .16; }
    else { [x, y] = E[i]; w = [0, 3, 6, 9].includes(i) ? .3 : .15; }
    const num = style === 'north' ? `<div class="sn">${SIGNS.indexOf(sign) + 1}</div>` : '';
    spots.push(`<foreignObject x="${(x - w / 2) * W}" y="${(y - .1) * W}" width="${w * W}" height="${.2 * W}"><div xmlns="http://www.w3.org/1999/xhtml" class="spot">${num}${items.join(' ')}</div></foreignObject>`);
  }
  const t = style === 'north' ? '' : `<text x="50" y="51" text-anchor="middle" class="ct">${esc(title)}</text>`;
  return `<svg class="chart" viewBox="0 0 100 100" role="img" aria-label="${esc(title)}"><rect x="0" y="0" width="100" height="100" rx="2"/>${lines.join('')}${t}${spots.join('')}</svg>`;
}
function running(ps, now) { const p = ps.find(x => now >= x.start && now < x.end); return p ? [p, ...running(p.children || [], now)] : []; }
function dashaTree(ps, system, now, depth) {
  return ps.map(p => {
    const isNow = now >= p.start && now < p.end, kids = p.children || [];
    const head = `<span class="bar" style="background:${system === 'chara' ? 'var(--gold)' : GCOL[p.lord || p.key]}"></span><span class="grow"><b class="${isNow ? 'now' : ''}">${esc(periodName(p, system))}</b><span class="small muted"> ${esc(dLabel(p.start))} – ${esc(dLabel(p.end))}</span></span>`;
    return kids.length ? `<details class="dasha d${depth}" ${isNow ? 'open' : ''}><summary>${head}</summary>${dashaTree(kids, system, now, depth + 1)}</details>`
      : `<div class="dasha d${depth} leaf">${head}</div>`;
  }).join('');
}
// As on iOS (StrengthSection): yogas with their rules, Kuja dosha and Kaal
// Sarp as placements, Shadbala and Ashtakavarga - no reading, no remedy.
function strengthHtml(j) {
  const st = j.strength, gn = k => name('grahas', k), names = gs => gs.map(gn).join(', ');
  const from = k => k === 'moon' || k === 'sun' || k === 'venus' ? gn(k) : t('jk.lagnaWord');
  const rule = y => {
    const h = y.houses || [];
    if (['ruchaka', 'bhadra', 'hamsa', 'malavya', 'sasa'].includes(y.key)) return t('yg.mahapurusha', names(y.grahas), h[0]);
    if (y.key === 'gajakesari') return t('yg.gajakesari', h[0]);
    if (y.key === 'parivartana') return t('yg.parivartana', gn(y.grahas[0]), gn(y.grahas[1]));
    if (y.key === 'budhaditya' || y.key === 'chandra-mangala') return t('yg.conjunction', gn(y.grahas[0]), gn(y.grahas[1]));
    if (y.key === 'kemadruma') return t('yg.kemadruma');
    if (y.key === 'amala') return t('yg.amala', names(y.grahas), from(y.from));
    return t(y.from === 'sun' ? 'yg.fromSun' : 'yg.fromMoon', names(y.grahas), h.join(', '));
  };
  const ks = st.kaalSarp === 'rahu-ketu' ? t('jk.kaalSarp', gn('rahu'), gn('ketu')) : st.kaalSarp === 'ketu-rahu' ? t('jk.kaalSarp', gn('ketu'), gn('rahu')) : t('jk.noKaalSarp');
  let html = `<div class="card"><p class="label">${esc(t('jk.yogas'))}</p><p class="small muted">${esc(t('jk.yogasNote'))}</p>
    ${st.yogas.map(y => `<div class="row" style="display:block"><b>${esc(name('chartYogas', y.key))}</b><div class="small muted">${esc(rule(y))}</div></div>`).join('')}</div>
    <div class="card"><p class="label">${esc(t('jk.doshas'))}</p><p class="small muted">${esc(t('jk.doshaNote'))}</p>
    ${st.kuja.map(k => `<div class="row" style="display:block">${esc(t('jk.kujaRow', k.house, from(k.from)))}<div class="small" style="color:${k.listed ? 'var(--accent)' : 'var(--muted)'}">${esc(t(k.listed ? 'jk.kujaListed' : 'jk.kujaNot'))}</div></div>`).join('')}
    <div class="row">${esc(ks)}</div></div>`;
  if (st.shadbala) {
    const top = Math.max(...st.shadbala.map(g => g.total), 1);
    html += `<div class="card"><p class="label">${esc(t('jk.shadbala'))}</p><p class="small muted">${esc(t('jk.sbNote'))}</p>
      ${st.shadbala.map(g => `<div class="sbrow"><span>${esc(gn(g.graha))}</span><span class="sbbar"><i style="width:${(g.total / top * 100).toFixed(1)}%"></i></span><span class="v"><b>${g.total.toFixed(2)}</b>${g.minimum ? `<small>${esc(t('jk.minimum', g.minimum.toFixed(1)))}</small>` : ''}</span></div>`).join('')}</div>`;
  }
  if (st.ashtakavarga) {
    const signs = ['mesha', 'vrishabha', 'mithuna', 'karka', 'simha', 'kanya', 'tula', 'vrishchika', 'dhanu', 'makara', 'kumbha', 'meena'], lg = j.lagna?.sign;
    const av = st.ashtakavarga;
    html += `<div class="card"><p class="label">${esc(t('jk.sav'))}</p><p class="small muted">${esc(t('jk.avNote'))}</p><div class="avwrap"><table class="av">
      <tr><th></th>${signs.map(s => `<th class="${s === lg ? 'lg' : ''}">${esc(name('rashis', s).slice(0, 3))}</th>`).join('')}</tr>
      <tr class="sav"><th>${esc(t('jk.sav'))}</th>${av.sav.map(n => `<td class="${n >= 28 ? 'hi' : ''}">${n}</td>`).join('')}</tr>
      ${av.bav.map(b => `<tr><th>${esc(gn(b.graha))}</th>${b.bindus.map(n => `<td>${n}</td>`).join('')}</tr>`).join('')}</table></div></div>`;
  } else html += `<p class="small muted">${esc(t('jk.needTime'))}</p>`;
  return html;
}

async function viewJathakam() {
  loading();
  const ps = births(), now = Date.now() / 1000;
  const person = ps.find(p => p.id === jkPerson) || ps[0];
  let body = '';
  if (jkSection !== 2) {
    body += `<div class="card"><p class="label">${esc(t('jk.whose'))}</p><div style="display:flex;gap:8px"><select id="jkp">${ps.map(p => `<option value="${p.id}" ${p === person ? 'selected' : ''}>${esc(personLabel(p))}</option>`).join('')}</select>
      <button class="btn soft" data-add>＋</button>${person ? `<button class="btn soft" data-edit>${esc(t('c.edit'))}</button>` : ''}</div>
      ${person ? `<div class="small muted" style="margin-top:6px">${esc(greg(person.date, { day: 'numeric', month: 'short', year: 'numeric' }))}${person.minutes != null ? ` · ${pad(Math.floor(person.minutes / 60))}:${pad(person.minutes % 60)}` : ''} · ${esc(person.place.name)}</div>` : `<p class="small muted">${esc(t('jk.noFamily'))}</p>`}</div>`;
  }
  const j = person && jkSection !== 2 ? await jataka(person) : null;
  if (j && !j.timeKnown) body += `<div class="banner">${esc(t('jk.noTime'))}</div>`;
  if (j && jkSection === 0) {
    const v = j.vargas.find(x => x.number === jkVarga) || j.vargas[0];
    const retro = new Set(j.grahas.filter(g => g.retrograde).map(g => g.graha));
    const moon = j.grahas.find(g => g.graha === 'moon').sign;
    const dm = d => `${Math.floor(d)}°${pad(Math.floor((d % 1) * 60))}′`;
    const row = (n, g) => `<div class="row"><span>${esc(n)}${g.retrograde ? ' ᴿ' : ''}</span><span class="v">${esc(name('rashis', g.sign))} ${dm(g.degrees)}<small>${esc(name('nakshatras', g.nakshatra))} · ${esc(t('bs.pada', g.pada))}</small></span></div>`;
    body += `<div class="chart-tools"><select id="jkv">${j.vargas.map(x => `<option value="${x.number}" ${x.number === v.number ? 'selected' : ''}>${esc(vargaName(x.number))}</option>`).join('')}</select>
      <select id="jks">${['south', 'north', 'east'].map(st => `<option value="${st}" ${chartStyle() === st ? 'selected' : ''}>${esc(t('jk.' + st))}</option>`).join('')}</select></div>
      ${chartSvg(chartStyle(), v.lagna, v.lagna || moon, v.signs, retro, vargaName(v.number))}
      ${v.number === 1 ? `<div class="card"><p class="label">${esc(t('jk.grahas'))}</p>${j.lagna ? row(t('bs.lagna'), j.lagna) : ''}${j.grahas.map(g => row(name('grahas', g.graha), g)).join('')}
        <div class="small muted">ᴿ ${esc(t('jk.retro'))} · Lahiri ${j.ayanamsa.toFixed(4)}°</div></div>` : ''}`;
  }
  if (j && jkSection === 1) {
    const d = jkSystem === 'yogini' ? j.yogini : jkSystem === 'chara' && j.chara ? j.chara : j.vimshottari;
    const sys = d === j.vimshottari ? 'vimshottari' : jkSystem;
    const first = d.periods.find(p => p.key === d.atBirth) || d.periods[0];
    const m = Math.round(d.balanceYears * 12);
    body += `<div class="seg" style="margin-bottom:12px">${['vimshottari', 'yogini', ...(j.chara ? ['chara'] : [])].map(x => `<button data-sys="${x}" class="${sys === x ? 'on' : ''}">${esc(t('jk.' + x))}</button>`).join('')}</div>
      <div class="card"><div>${esc(t('jk.atBirth', periodName(first, sys), t('jk.ym', Math.floor(m / 12), m % 12)))}</div>
        <div class="now">${esc(t('jk.running', running(d.periods, now).map(p => periodName(p, sys)).join(' › ')))}</div></div>
      <div class="dashas">${dashaTree(d.periods, sys, now, 0)}</div>`;
  }
  if (j && jkSection === 3 && j.strength) body += strengthHtml(j);
  if (jkSection === 2) {
    adoptFamilyless();
    const pick = S.sandhiPick || [], fam = [];
    for (const p of ps.filter(x => !jkFamily || (jkFamily === 'pick' ? pick.includes(x.id) : x.family === jkFamily))) fam.push([p, await jataka(p)]);
    const Y = 31557600, from = jkAhead ? now : now - jkSpan * Y, to = jkAhead ? now + jkSpan * Y : now;
    const sandhis = [];
    for (const [p, jj] of fam) { const ms = jj.vimshottari.periods; for (let i = 1; i < ms.length; i++) if (ms[i].start >= from && ms[i].start < to) sandhis.push({ p, a: ms[i - 1], b: ms[i], s: ms[i - 1].children.at(-1).start, e: ms[i].children[0].end }); }
    sandhis.sort((x, y) => jkAhead ? x.b.start - y.b.start : y.b.start - x.b.start);
    const pct = u => ((Math.min(Math.max(u, from), to) - from) / (to - from) * 100).toFixed(2);
    body += `<div style="display:flex;gap:8px;align-items:center"><div class="seg" style="flex:1"><button data-ahead="1" class="${jkAhead ? 'on' : ''}">${esc(t('jk.ahead'))}</button><button data-ahead="0" class="${!jkAhead ? 'on' : ''}">${esc(t('jk.past'))}</button></div>
      <select id="jkspan" style="width:auto">${[10, 20, 40].map(n => `<option value="${n}" ${n === jkSpan ? 'selected' : ''}>${esc(t('jk.span', n))}</option>`).join('')}</select></div>
      <div class="vc-chips"><button class="pill ${!jkFamily ? 'on' : ''}" data-jf="">${esc(t('f.all'))}</button>${S.families.map(f => `<button class="pill ${jkFamily === f.id ? 'on' : ''}" data-jf="${f.id}">${esc(f.name)}</button>`).join('')}
        <button class="pill ${jkFamily === 'pick' ? 'on' : ''}" data-pick>☑ ${esc(jkFamily === 'pick' ? t('fg.picked', pick.length) : t('fg.choose'))}</button><button class="linkbtn" data-fams style="padding:0 6px">👪 ${esc(t('fg.manage'))}</button></div>
      <p class="small muted">${esc(t('jk.sandhiNote'))}</p>
      ${!fam.length ? `<div class="card"><p>${esc(t('jk.noFamily'))}</p><button class="btn" data-add>＋ ${esc(t('m.addProfile'))}</button></div>` : `
      <div class="card"><div class="small muted" style="display:flex;justify-content:space-between"><span>${esc(dLabel(from))}</span><span>${esc(dLabel(to))}</span></div>
        ${fam.map(([p, jj]) => `<div style="margin-top:10px"><b>${esc(personLabel(p))}</b><div class="tl">${jj.vimshottari.periods.filter(m => m.end > from && m.start < to).map(m => `<span class="seg-m" style="left:${pct(m.start)}%;width:${(pct(m.end) - pct(m.start)).toFixed(2)}%;background:${GCOL[m.key]}">${pct(m.end) - pct(m.start) > 6 ? esc(name('grahaShort', m.key)) : ''}</span>`).join('')}
          ${sandhis.filter(x => x.p === p).map(x => `<span class="band" style="left:${pct(x.s)}%;width:${Math.max(.8, pct(x.e) - pct(x.s)).toFixed(2)}%"></span>`).join('')}</div></div>`).join('')}</div>
      ${sandhis.length ? `<div class="card"><p class="label">${esc(t('jk.sandhi'))}</p>${sandhis.map(x => `<div class="list-row"><div class="grow"><b>${esc(x.p.name)}</b><div><span style="color:${GCOL[x.a.key]}">●</span> ${esc(name('grahas', x.a.key))} → <span style="color:${GCOL[x.b.key]}">●</span> ${esc(name('grahas', x.b.key))}</div><div class="small muted">${esc(dLabel(x.s))} – ${esc(dLabel(x.e))}</div></div><b style="color:var(--accent)">${esc(dLabel(x.b.start))}</b></div>`).join('')}</div>` : ''}
      <button class="btn soft" data-add>＋ ${esc(t('m.addProfile'))}</button>`}`;
  }
  $('#main').innerHTML = `<div class="seg" style="margin-bottom:14px">${[['jk.chart', 0], ['jk.dasha', 1], ['jk.strength', 3], ['jk.family', 2]].map(([k, i]) => `<button data-jk="${i}" class="${jkSection === i ? 'on' : ''}">${esc(t(k))}</button>`).join('')}</div>${body}<p class="small muted">${esc(t('jk.chartNote'))}</p>`;
  const q = x => $('#main').querySelector(x), qa = x => $('#main').querySelectorAll(x);
  qa('[data-jk]').forEach(b => b.onclick = () => { jkSection = +b.dataset.jk; viewJathakam(); });
  q('#jkp')?.addEventListener('change', e => { jkPerson = e.target.value; viewJathakam(); });
  q('#jkv')?.addEventListener('change', e => { jkVarga = +e.target.value; viewJathakam(); });
  q('#jks')?.addEventListener('change', e => { S.chartStyle = e.target.value; save(); viewJathakam(); });
  q('#jkspan')?.addEventListener('change', e => { jkSpan = +e.target.value; viewJathakam(); });
  qa('[data-sys]').forEach(b => b.onclick = () => { jkSystem = b.dataset.sys; viewJathakam(); });
  qa('[data-ahead]').forEach(b => b.onclick = () => { jkAhead = b.dataset.ahead === '1'; viewJathakam(); });
  qa('[data-jf]').forEach(b => b.onclick = () => { jkFamily = b.dataset.jf || null; viewJathakam(); });
  q('[data-pick]')?.addEventListener('click', () => peoplePicker(ps));
  q('[data-fams]')?.addEventListener('click', familiesManager);
  qa('[data-add]').forEach(b => b.onclick = () => personEditor(null, '', rec => { jkPerson = rec.id; viewJathakam(); }));
  q('[data-edit]')?.addEventListener('click', () => personEditor(person, '', () => viewJathakam()));
}

// ---------------------------------------------------------------- planets & eclipses
// As on iOS (Views/SkyView.swift): the planets now and the year's sign
// changes, stations and eclipses for home. Events only.
const skyCache = new Map();
let skyYear = new Date().getFullYear(), skyFilter = 'all';
async function skyEvents(y) {
  const key = `${y}|${S.home.id}`;
  if (!skyCache.has(key)) skyCache.set(key, engine({ op: 'sky', year: y, location: S.home }));
  return skyCache.get(key);
}
function skyTitle(e) {
  if (e.kind === 'ingress') return t('sk.enters', name('grahas', e.graha), name('rashis', e.sign));
  if (e.kind === 'retrograde') return t('sk.retro', name('grahas', e.graha));
  if (e.kind === 'direct') return t('sk.direct', name('grahas', e.graha));
  return `${t(e.kind === 'solar-eclipse' ? 'sk.solar' : 'sk.lunar')} · ${t('sk.' + e.eclipse)}`;
}
// As on iOS (EclipseSheet): each phase in local time, the traditional sutak
// when the eclipse is seen here, and what an eclipse is - information only.
function eclipseSheet(e) {
  const when = u => dtf({ day: 'numeric', month: 'short', timeZone: S.home.tz }).format(new Date(u * 1000)) + ' · ' + clock(u);
  const phases = (e.contacts || []).map(c => `<div class="row"><span class="muted">${esc(t('sk.' + c.phase))}</span><span class="v">${esc(when(c.at))}</span></div>`).join('');
  sheet(`<h2 class="serif" style="margin:4px 0">${esc(skyTitle(e))}</h2>
    ${e.visible !== undefined ? `<p class="small" style="font-weight:700;color:${e.visible ? 'var(--accent)' : 'var(--muted)'}">${esc(t(e.visible ? 'sk.visible' : 'sk.notVisible', S.home.name))}</p>` : ''}
    ${phases ? `<div class="card"><p class="label">${esc(t('sk.phasesFor', S.home.name))}</p>${phases}${e.sutak ? `<p class="small" style="margin-top:8px">${esc(t('sk.sutak', when(e.sutak)))}</p>` : ''}</div>` : ''}
    <p>${esc(t(e.kind === 'solar-eclipse' ? 'sk.aboutSolar' : 'sk.aboutLunar'))}</p>`);
}

async function viewSky() {
  loading();
  const tz = S.home.tz, nowLocal = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':');
  const now = await engine({ op: 'jataka', date: today(), minutes: +nowLocal[0] * 60 + +nowLocal[1], location: S.home });
  const ev = (await skyEvents(skyYear)).filter(e => skyFilter === 'all' || (skyFilter === 'eclipses' ? e.kind.endsWith('eclipse') : skyFilter === 'ingress' ? e.kind === 'ingress' : e.kind === 'retrograde' || e.kind === 'direct'));
  const month = u => dtf({ month: 'long', year: 'numeric', timeZone: tz }).format(new Date(u * 1000));
  let html = `<div class="card"><p class="label">${esc(t('sk.now'))}</p><div class="planets">${now.grahas.map(g => `<div><span style="color:${GCOL[g.graha]}">●</span> <b>${esc(name('grahas', g.graha))}${g.retrograde ? ' ᴿ' : ''}</b><div class="small muted">${esc(name('rashis', g.sign))} ${Math.floor(g.degrees)}° · ${esc(name('nakshatras', g.nakshatra))}</div></div>`).join('')}</div></div>
    <div class="dayhead" style="margin:0"><div class="nav"><button class="arrow" data-sy="-1">‹</button><b class="serif" style="font-size:22px">${skyYear}</b><button class="arrow" data-sy="1">›</button></div></div>
    <div class="seg" style="margin:8px 0 14px">${[['all', 'f.all'], ['eclipses', 'sk.eclipses'], ['ingress', 'sk.ingress'], ['stations', 'sk.stations']].map(([k, l]) => `<button data-sf="${k}" class="${skyFilter === k ? 'on' : ''}">${esc(t(l))}</button>`).join('')}</div>`;
  let cur = '';
  for (const e of ev) {
    const m = month(e.at);
    if (m !== cur) { html += `${cur ? '</div>' : ''}<p class="label" style="margin-top:12px">${esc(m)}</p><div class="card">`; cur = m; }
    const icon = e.kind === 'ingress' ? '→' : e.kind.endsWith('eclipse') ? (e.kind === 'solar-eclipse' ? '☀' : '☾') : '↺';
    html += `<div class="list-row" ${e.kind.endsWith('eclipse') ? `data-ecl="${ev.indexOf(e)}" style="cursor:pointer"` : ''}><span style="font-size:20px;width:24px;text-align:center;color:${e.kind.endsWith('eclipse') ? 'var(--accent)' : GCOL[e.graha] || 'var(--muted)'}">${icon}</span><div class="grow"><b>${esc(skyTitle(e))}</b>
      <div class="small muted">${esc(dLabel(e.at))} · ${esc(clock(e.at))}</div>
      ${e.visible !== undefined ? `<div class="small" style="font-weight:700;color:${e.visible ? 'var(--accent)' : 'var(--muted)'}">${esc(t(e.visible ? 'sk.visible' : 'sk.notVisible', S.home.name))}</div>` : ''}
      ${e.start ? `<div class="small muted">${esc(clock(e.start))} – ${esc(clock(e.end))} · ${esc(t('sk.greatest', clock(e.at)))}</div>` : ''}</div></div>`;
  }
  html += (cur ? '</div>' : '') + `<p class="small muted">${esc(t('sk.note'))}</p>`;
  $('#main').innerHTML = html;
  $('#main').querySelectorAll('[data-sy]').forEach(b => b.onclick = () => { skyYear += +b.dataset.sy; viewSky(); });
  $('#main').querySelectorAll('[data-sf]').forEach(b => b.onclick = () => { skyFilter = b.dataset.sf; viewSky(); });
  $('#main').querySelectorAll('[data-ecl]').forEach(r => r.onclick = () => eclipseSheet(ev[+r.dataset.ecl]));
}

// ---------------------------------------------------------------- temples
// Major temples by deity (content/src/temples.json); deities from the
// user's vrats lead. Only confirmed official addresses are ever linked.
let TEMPLES = null, tmDeity = null;
function deityForVrat(k) {
  if (['ekadashi', 'purnima', 'pournami', 'satyanarayan', 'guruvar'].some(x => k.includes(x))) return 'vishnu';
  if (['pradosh', 'shivaratri', 'somvar', 'somavara', 'thingal', 'kalashtami', 'theipirai'].some(x => k.includes(x))) return 'shiva';
  if (k.startsWith('sank') || k.includes('vinayaka')) return 'ganesha';
  if (k.includes('shashti') || k.includes('karthigai')) return 'murugan';
  if (k.includes('hanuman')) return 'hanuman';
  if (k.includes('shani')) return 'shani';
  if (['santoshi', 'velli', 'durgashtami'].some(x => k.includes(x))) return 'devi';
  return null;
}
// As on iOS: nearest to the home location (or a city the user picks), by
// deity, each deity's temples nearest first; a deity filter, All by default.
let tmNear = null, tmRegion = null, tmQuery = '';
const deityIcon = (d, size = 18) => `<i class="dicon" style="width:${size}px;height:${size}px;-webkit-mask-image:url(icons/${d}.svg);mask-image:url(icons/${d}.svg)"></i>`;
const compass = (o, x) => {
  const r = Math.PI / 180, y = Math.sin((x.lon - o.longitude) * r) * Math.cos(x.lat * r);
  const z = Math.cos(o.latitude * r) * Math.sin(x.lat * r) - Math.sin(o.latitude * r) * Math.cos(x.lat * r) * Math.cos((x.lon - o.longitude) * r);
  return ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'][Math.round(((Math.atan2(y, z) / r + 360) % 360) / 45) % 8];
};
function kmFrom(o, x) {
  const r = Math.PI / 180, p1 = o.latitude * r, p2 = x.lat * r, dp = p2 - p1, dl = (x.lon - o.longitude) * r;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
// Miles where roads are signed in miles (the United States, Britain), kilometres elsewhere: by the home country.
function distText(km) {
  const miles = ['US', 'GB', 'LR', 'MM'].includes(S.home?.country);
  const v = miles ? km / 1.609344 : km;
  return new Intl.NumberFormat(locale(), { style: 'unit', unit: miles ? 'mile' : 'kilometer', maximumFractionDigits: 0 }).format(v);
}
// ---------------------------------------------------------------- prayers
// As on iOS (PrayersView): traditional hymns by deity, for daily worship. Devotion only: nothing
// here reads a profile, star or chart, and the app's own words say what a hymn is, never what it
// does (content/scripts/audit_prayers.py checks them).
let PRAYERS = null;
const PRV = { deity: null, id: null, q: '' };
const PR_SCRIPT = { hi: 'deva', mr: 'deva', ne: 'deva', bn: 'beng', gu: 'gujr', or: 'orya', te: 'telu', kn: 'knda', ml: 'mlym', ta: 'taml' };
const PR_SCRIPT_NAME = { deva: 'देवनागरी', telu: 'తెలుగు', knda: 'ಕನ್ನಡ', mlym: 'മലയാളം', gujr: 'ગુજરાતી', beng: 'বাংলা', orya: 'ଓଡ଼ିଆ', taml: 'தமிழ்' };
async function loadPrayers() { PRAYERS ??= await (await fetch('packs/prayers.json?v=' + V)).json(); return PRAYERS; }
// Today's prayer: the weekday's deity by custom, one of its hymns per week in turn. Only the date decides.
function todayPrayer() {
  if (!PRAYERS) return null;
  const d = parse(today()), deity = PRAYERS.weekdays[['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getUTCDay()]];
  const list = PRAYERS.prayers.filter(p => p.deity === deity), week = Math.floor(d.getTime() / 864e5 / 7);
  return list.length ? list[week % list.length] : null;
}
const PR_SCRIPTS = ['deva', 'telu', 'knda', 'mlym', 'taml', 'gujr', 'beng', 'orya'];
// The tradition's own script; the reader's choice, else that.
const traditionScript = () => PR_SCRIPT[pack?.language] || 'deva';
const prayerScript = () => PR_SCRIPTS.includes(S.prayerScript) ? S.prayerScript : traditionScript();
const prayerScriptTitle = p => p.titleScript[prayerScript()] || p.titleDeva;
// The name in the app's language, and the other form beneath.
const prayerTitle = p => S.native ? prayerScriptTitle(p) : p.title;
const prayerSubtitle = p => S.native ? p.title : prayerScriptTitle(p);
const prayerLine = p => [t('deity.' + p.deity), t('pr.k.' + p.kind), t('pr.a.' + p.by), p.verses === 1 ? t('pr.verse1') : t('pr.verses', p.verses)].join(' · ');
const prayerRow = p => `<button class="list-row" data-pr="${p.id}" style="width:100%;text-align:left;border:0;background:var(--card);border-radius:14px;margin-bottom:8px;padding:12px;cursor:pointer;color:inherit;font:inherit">
  <div class="grow"><b>${esc(prayerTitle(p))}</b><div class="small muted">${esc(prayerSubtitle(p))}</div><div class="small muted">${esc(prayerLine(p))}</div></div><span class="muted">›</span></button>`;
async function viewPrayers() {
  loading();
  const book = await loadPrayers();
  if (tab !== 'prayers') return;
  if (PRV.id) return prayerReader(book.prayers.find(p => p.id === PRV.id));
  const wire = () => {
    $('#main').querySelectorAll('[data-pr]').forEach(b => b.onclick = () => { PRV.id = b.dataset.pr; viewPrayers(); scrollTo(0, 0); });
    $('#main').querySelectorAll('[data-pd]').forEach(b => b.onclick = () => { PRV.deity = b.dataset.pd || null; viewPrayers(); scrollTo(0, 0); });
  };
  if (PRV.deity) {
    $('#main').innerHTML = `<button class="linkbtn" data-pd="">‹ ${esc(t('py.title'))}</button><h2 class="serif">${esc(t('deity.' + PRV.deity))}</h2>${book.prayers.filter(p => p.deity === PRV.deity).map(prayerRow).join('')}`;
    return wire();
  }
  const tp = todayPrayer(), favs = (S.favPrayers || []).map(id => book.prayers.find(p => p.id === id)).filter(Boolean);
  const day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][parse(today()).getUTCDay()];
  const list = () => {
    const q = PRV.q.trim().toLowerCase();
    // Search by deity or title only.
    if (q) { const hits = book.prayers.filter(p => p.title.toLowerCase().includes(q) || prayerScriptTitle(p).includes(PRV.q.trim()) || t('deity.' + p.deity).toLowerCase().includes(q) || p.deity.includes(q));
      return hits.length ? hits.map(prayerRow).join('') : `<p class="muted">${esc(t('pr.none'))}</p>`; }
    return `${tp ? `<button class="card" data-pr="${tp.id}" style="width:100%;text-align:left;border:0;cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 80%,transparent))">
        <div style="display:flex;align-items:center"><span class="small grow" style="font-weight:700;letter-spacing:1px;opacity:.85">${esc(t('pr.today').toUpperCase())}</span><span style="color:#fff;opacity:.9">${deityIcon(tp.deity, 32)}</span></div><div class="serif" style="font-size:24px;font-weight:700">${esc(prayerTitle(tp))}</div><div style="opacity:.9">${esc(prayerSubtitle(tp))}</div>
        <div class="small" style="opacity:.9">${esc(prayerLine(tp))}</div><div class="small" style="opacity:.8">${esc(t('pr.weekday', name('weekdays', day), t('deity.' + tp.deity)))}</div></button>` : ''}
      ${favs.length ? `<p class="label">${esc(t('pr.favorites'))}</p>${favs.map(prayerRow).join('')}` : ''}
      <p class="label">${esc(t('pr.deities'))}</p><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">${book.deities.map(d => { const n = book.prayers.filter(p => p.deity === d).length;
        return `<button class="card" data-pd="${d}" style="margin:0;text-align:left;cursor:pointer;color:inherit;font:inherit"><span style="color:var(--accent);display:block;margin-bottom:6px">${deityIcon(d, 30)}</span><b>${esc(t('deity.' + d))}</b><div class="small muted">${esc(n === 1 ? t('pr.k.hymn') : t('pr.hymns', n))}</div></button>`; }).join('')}</div>`;
  };
  $('#main').innerHTML = `<h2 class="serif" style="margin-bottom:4px">${esc(t('py.title'))}</h2><p class="muted" style="margin-top:0">${esc(t('pr.intro'))}</p>
    <input type="search" id="prq" class="field" placeholder="${esc(t('pr.search'))}" value="${esc(PRV.q)}" style="width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;margin-bottom:12px"><div id="prlist">${list()}</div>`;
  $('#prq').oninput = e => { PRV.q = e.target.value; $('#prlist').innerHTML = list(); wire(); };
  wire();
}
function prayerReader(p) {
  if (!p) { PRV.id = null; return viewPrayers(); }
  // Every script the app's languages read, the tradition's first.
  const scripts = [traditionScript(), ...PR_SCRIPTS.filter(x => x !== traditionScript())];
  const sc = prayerScript(), verses = p.text[sc] || p.text.deva;
  const fav = (S.favPrayers || []).includes(p.id), ed = PRAYERS.editions[p.edition];
  $('#main').innerHTML = `<div style="display:flex;align-items:center;gap:8px"><button class="linkbtn" data-back>‹ ${esc(PRV.deity ? t('deity.' + PRV.deity) : t('py.title'))}</button><span class="grow"></span>
      <button class="btn soft" data-fav aria-label="${esc(t(fav ? 'pr.unfavorite' : 'pr.favorite'))}" title="${esc(t(fav ? 'pr.unfavorite' : 'pr.favorite'))}">${fav ? '★' : '☆'}</button>
      <button class="btn soft" data-share aria-label="${esc(t('pr.share'))}">${SHARE_ICON}</button></div>
    <h2 class="serif" style="margin:8px 0 2px">${esc(prayerTitle(p))}</h2><div style="color:var(--accent);font-size:18px">${esc(prayerSubtitle(p))}</div><div class="small muted">${esc(prayerLine(p))}</div>
    <label class="placechip" style="display:inline-flex;margin:12px 0">📖 <select id="prsc" aria-label="${esc(t('s.language'))}">${scripts.map(x => `<option value="${x}" ${x === sc ? 'selected' : ''}>${esc(PR_SCRIPT_NAME[x])}</option>`).join('')}</select></label>
    <div class="prtext">${verses.map(v => `<p>${esc(v).replace(/\n/g, '<br>')}</p>`).join('')}</div>
    <p class="small muted">${p.phala ? esc(t('pr.phala')) + '<br>' : ''}${ed ? esc(t('pr.source', ed.name)) : ''}</p>`;
  const m = $('#main');
  m.querySelector('[data-back]').onclick = () => { PRV.id = null; viewPrayers(); };
  m.querySelector('#prsc').onchange = e => { S.prayerScript = e.target.value; save(); prayerReader(p); };
  m.querySelector('[data-fav]').onclick = () => { S.favPrayers = fav ? (S.favPrayers || []).filter(x => x !== p.id) : [...(S.favPrayers || []), p.id]; save(); prayerReader(p); };
  // The title and the text, nothing more.
  m.querySelector('[data-share]').onclick = async () => { const text = prayerTitle(p) + '\n\n' + verses.join('\n\n');
    try { if (navigator.share) await navigator.share({ title: prayerTitle(p), text }); else { await navigator.clipboard.writeText(text); } } catch {} };
}

// ---------------------------------------------------------------- traditional time
// As on iOS (OldTimeView): clock time and nazhika/vinazhika (ghati/pal...) from that day's sunrise, both
// ways. A nazhika is 24 minutes, or the day (sunrise to the next sunrise) in sixty; muhurtas (15 by day,
// 15 by night) and yamas (4 and 4) follow the day's and night's own lengths. Free.
const OT = { toClock: false, proportional: false, date: null, time: null, n: 15, v: 0, place: null };
const timeUnitNames = () => { const u = pack?.display?.timeUnits; return (S.native ? u?.native : u?.en) || u?.en || ['ghati', 'pal']; };
function tradTime(p, t, prop, before, dayDate) {
  const unit = prop ? (p.nextSunrise - p.sunrise) / 60 : 1440, el = t - p.sunrise;
  const n = Math.min(59, Math.floor(el / unit)), v = Math.min(59, Math.floor((el - n * unit) / (unit / 60)));
  const night = t >= p.sunset, from = night ? p.sunset : p.sunrise, span = night ? p.nextSunrise - p.sunset : p.sunset - p.sunrise;
  const part = (t - from) / Math.max(span, 1);
  return { n, v, night, muhurta: Math.min(15, Math.floor(part * 15) + 1), yama: Math.min(4, Math.floor(part * 4) + 1), before, dayDate, p };
}
async function viewOldTime() {
  const u = timeUnitNames(), place = OT.place || S.home;
  OT.date ||= today(place.tz);
  if (OT.time == null) { const now = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: place.tz }).format(new Date()); OT.time = now; }
  const opts = n => Array.from({ length: 60 }, (_, i) => `<option ${i === n ? 'selected' : ''}>${i}</option>`).join('');
  $('#main').innerHTML = `<h2 class="serif" style="margin-bottom:4px">${esc(t('ot.title'))}</h2><p class="muted" style="margin-top:0">${esc(t('ot.intro', u[0], u[1]))}</p>
    <div class="seg" style="margin:8px 0"><button data-ot="0" class="${!OT.toClock ? 'on' : ''}">${esc(t('ot.toTrad', u[0]))}</button><button data-ot="1" class="${OT.toClock ? 'on' : ''}">${esc(t('ot.toClock', u[0]))}</button></div>
    <div class="card">
      <label class="field"><span>${esc(t('ot.date'))}</span><input type="date" id="otd" value="${OT.date}" min="1900-01-01" max="2100-12-31"></label>
      ${OT.toClock ? `<label class="field"><span>${esc(u[0])}</span><select id="otn">${opts(OT.n)}</select></label><label class="field"><span>${esc(u[1])}</span><select id="otv">${opts(OT.v)}</select></label>`
        : `<label class="field"><span>${esc(t('pp.time'))}</span><input type="time" id="ott" value="${OT.time}"></label>`}
      <div class="field"><span>${esc(t('pp.place'))}: <b>${esc(place.name)}</b></span><div id="otpick"></div></div>
    </div>
    <div class="seg" style="margin:8px 0"><button data-op="0" class="${!OT.proportional ? 'on' : ''}">${esc(t('ot.fixed'))}</button><button data-op="1" class="${OT.proportional ? 'on' : ''}">${esc(t('ot.proportional'))}</button></div>
    <div id="otres"><div class="loading"><div class="ring"><i></i></div></div></div>
    <p class="small muted">${esc(t('ot.units', u[0], u[1]))}</p>`;
  const m = $('#main');
  m.querySelectorAll('[data-ot]').forEach(b => b.onclick = () => { OT.toClock = b.dataset.ot === '1'; viewOldTime(); });
  m.querySelectorAll('[data-op]').forEach(b => b.onclick = () => { OT.proportional = b.dataset.op === '1'; viewOldTime(); });
  m.querySelector('#otd').onchange = e => { if (e.target.value) { OT.date = e.target.value; viewOldTime(); } };
  m.querySelector('#ott')?.addEventListener('change', e => { OT.time = e.target.value; viewOldTime(); });
  m.querySelector('#otn')?.addEventListener('change', e => { OT.n = +e.target.value; viewOldTime(); });
  m.querySelector('#otv')?.addEventListener('change', e => { OT.v = +e.target.value; viewOldTime(); });
  placePicker(m.querySelector('#otpick'), pl => { OT.place = pl; viewOldTime(); });
  // The calculation, for the chosen place (its own year tables).
  const pd = await day(OT.date, place).catch(() => null); if (!pd || tab !== 'oldtime') return;
  const clockAt = u2 => dtf({ hour: 'numeric', minute: '2-digit', ...hourOpts(), timeZone: place.tz }).format(new Date(u2 * 1000));
  let r, head;
  if (OT.toClock) {
    const unit = OT.proportional ? (pd.nextSunrise - pd.sunrise) / 60 : 1440, tt = pd.sunrise + Math.floor(OT.n * unit + OT.v * unit / 60);
    const on = new Intl.DateTimeFormat('en-CA', { timeZone: place.tz }).format(new Date(tt * 1000));
    r = tradTime(pd, tt, OT.proportional, false, OT.date);
    head = t('ot.clockIs', clockAt(tt), greg(on, { day: 'numeric', month: 'long', year: 'numeric' }));
  } else {
    // The clock time on that date where the place is: its offset there, then the instant.
    const [hh, mm] = OT.time.split(':').map(Number), [y, mo, dd] = OT.date.split('-').map(Number);
    const guess = Date.UTC(y, mo - 1, dd, hh, mm) / 1000;
    const off = (() => { const f = new Intl.DateTimeFormat('en-US', { timeZone: place.tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
      const q = Object.fromEntries(f.formatToParts(new Date(guess * 1000)).map(x => [x.type, x.value])); return (Date.UTC(+q.year, +q.month - 1, +q.day, +q.hour, +q.minute) / 1000) - guess; })();
    const tt = guess - off;
    if (tt < pd.sunrise) { const prev = addDays(OT.date, -1), py = await day(prev, place); r = tradTime(py, tt, OT.proportional, true, prev); }
    else r = tradTime(pd, tt, OT.proportional, false, OT.date);
    head = t('ot.result', r.n, u[0], r.v, u[1]);
  }
  const secs = Math.floor((r.p.nextSunrise - r.p.sunrise) / 60);
  $('#otres').innerHTML = `<div class="card"><div class="serif" style="font-size:24px;font-weight:700;color:var(--accent)">${esc(head)}</div>
    <p style="font-weight:600;margin:8px 0 4px">${esc(t('ot.dayOf', greg(r.dayDate)))}</p>${r.before ? `<p class="small" style="color:var(--accent);margin:0 0 6px">${esc(t('ot.prevDay'))}</p>` : ''}
    <div class="row"><span class="muted">${esc(t('sun.sunrise'))}</span><span class="v">${esc(clockAt(r.p.sunrise))}</span></div>
    <div class="row"><span class="muted">${esc(t('sun.sunset'))}</span><span class="v">${esc(clockAt(r.p.sunset))}</span></div>
    <p style="margin:8px 0 2px">${esc(t(r.night ? 'ot.muhurtaNight' : 'ot.muhurtaDay', r.muhurta))}</p><p style="margin:0 0 8px">${esc(t(r.night ? 'ot.yamaNight' : 'ot.yamaDay', r.yama))}</p>
    <p class="small muted">${esc(t('ot.lengthNote', u[0], t('ot.minSec', Math.floor(secs / 60), secs % 60)))}</p></div>`;
}

async function viewTemples() {
  TEMPLES ??= await (await fetch('temples.json?v=' + V)).json();
  const yours = [...new Set(S.vrats.map(deityForVrat).filter(Boolean))];
  const order = [...yours, ...TEMPLES.deities.filter(d => !yours.includes(d))];
  const origin = tmNear || S.home;
  // A deity with its family (Vishnu brings Krishna, Rama, Jagannath, Venkateswara), in one state or everywhere.
  const shown = tmDeity ? [tmDeity, ...TEMPLES.deities.filter(d => TEMPLES.parents?.[d] === tmDeity)] : order;
  const region = x => x.place.split(', ').pop();
  const regions = [...new Set(TEMPLES.temples.map(region))].sort();
  const travel = x => {
    const rows = [];
    if (x.air?.length) rows.push(['✈︎', t('tm.air'), x.air.map(a => `${a[0]} (${a[1]}), ${distText(a[2])}`).join(' · ')]);
    if (x.rail?.length) rows.push(['🚆', t('tm.rail'), x.rail.map(r => `${r[0]}, ${distText(r[1])}`).join(' · ')]);
    const k = kmFrom(origin, x);
    if (k > 2) rows.push(['🚗', t('tm.road'), t('tm.roadFrom', distText(k), t('dir.' + compass(origin, x)), origin.name)]);
    return `<p class="label">${esc(t('tm.getting'))}</p>${rows.map(([i, h, v]) => `<div class="small" style="margin:4px 0">${i} <b>${esc(h)}</b> · ${esc(v)}</div>`).join('')}`;
  };
  const card = x => `<div class="card temple"><h2 class="serif">${deityIcon(x.deity, 20)} ${esc(x.name)}</h2><div class="small muted tmplace"><span>📍 ${esc(x.place)}</span><span>${esc(distText(kmFrom(origin, x)))}</span></div>
    ${x.built ? `<div class="small" style="color:var(--accent);font-weight:700">🕰 ${esc(t('tm.built', x.built))}</div>` : ''}
    <p class="label">${esc(t('tm.significance'))}</p><p>${esc(x.about)}</p>
    ${x.tips?.length ? `<p class="label">${esc(t('tm.tips'))}</p>${x.tips.map(tp => `<div class="small">💡 ${esc(tp)}</div>`).join('')}` : ''}
    ${travel(x)}
    ${x.donate ? `<a class="btn block" href="${esc(x.donate)}" target="_blank" rel="noopener">♥ ${esc(t('tm.donate'))}</a>` : x.site ? '' : `<p class="small muted">${esc(t('tm.noLink'))}</p>`}
    <div class="links">${x.site && x.site !== x.donate ? `<a href="${esc(x.site)}" target="_blank" rel="noopener">🌐 ${esc(t('tm.site'))}</a>` : ''}
    ${x.wiki ? `<a href="${esc(x.wiki)}" target="_blank" rel="noopener">📖 ${esc(t('tm.wiki'))}</a>` : ''}
    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.name + ', ' + x.place)}" target="_blank" rel="noopener">🗺 ${esc(t('tm.directions'))}</a></div></div>`;
  const groups = shown.map(d => {
    const q = tmQuery.trim().toLowerCase();
    const list = TEMPLES.temples.filter(x => x.deity === d && (!tmRegion || region(x) === tmRegion) && (!q || x.name.toLowerCase().includes(q) || x.place.toLowerCase().includes(q))).sort((a, b) => kmFrom(origin, a) - kmFrom(origin, b));
    return list.length ? `${tmDeity && shown.length === 1 ? '' : `<h2 class="serif tmdeity">${deityIcon(d, 22)} ${esc(t('deity.' + d))}</h2>`}${list.map(card).join('')}` : '';
  }).join('');
  $('#main').innerHTML = `<div class="card tmnear"><div class="row" style="border:0;align-items:center"><b>📍 ${esc(t('tm.near', origin.name))}</b>
      <span>${tmNear ? `<button class="btn soft" data-tmhome>${esc(t('dual.home'))}</button> ` : ''}<button class="btn soft" data-tmpick>${esc(t('cal.other'))}</button></span></div><div id="tmpp"></div></div>
    <input class="search" id="tmq" placeholder="${esc(t('tm.search'))}" value="${esc(tmQuery)}">
    <label class="field"><span>${esc(t('tm.where'))}</span><select id="tmregion"><option value="">${esc(t('tm.everywhere'))}</option>${regions.map(r => `<option ${r === tmRegion ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
    ${yours.length ? `<p class="label">${esc(t('tm.yours'))}</p>` : ''}
    <div class="vc-chips"><button class="pill ${!tmDeity ? 'on' : ''}" data-deity="">${esc(t('f.all'))}</button>${order.map(d => `<button class="pill ${d === tmDeity ? 'on' : ''}" data-deity="${d}">${yours.includes(d) ? '☾ ' : ''}${deityIcon(d, 14)} ${esc(t('deity.' + d))}</button>`).join('')}</div>
    ${groups}<p class="small muted">${esc(t('tm.note'))}</p>`;
  $('#main').querySelectorAll('[data-deity]').forEach(b => b.onclick = () => { tmDeity = b.dataset.deity || null; viewTemples(); });
  $('#tmregion').onchange = e => { tmRegion = e.target.value || null; viewTemples(); };
  $('#tmq').oninput = e => { tmQuery = e.target.value; clearTimeout(viewTemples.t); viewTemples.t = setTimeout(() => { viewTemples().then(() => { const i = $('#tmq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 250); };
  $('#main').querySelector('[data-tmhome]')?.addEventListener('click', () => { tmNear = null; viewTemples(); });
  $('#main').querySelector('[data-tmpick]').onclick = () => placePicker($('#tmpp'), p => { tmNear = p; viewTemples(); });
}

// ---------------------------------------------------------------- the engine's reason, in words
// The engine says how it chose a day in fixed English ("tithi 13 prevails at pradosh");
// this reads it back in the user's language, naming tithis, stars, months and kalas as the tradition does.
function tithiTerm(n) {
  const keys = pack.names.tithis ? Object.keys(pack.names.tithis) : [];
  if (n === 15) return name('tithis', 'purnima');
  if (n === 30) return name('tithis', 'amavasya');
  const k = keys[(n - 1) % 15];
  return `${name('paksha', n < 15 ? 'shukla' : 'krishna')} ${name('tithis', k)}`;
}
function ruleTerm(w) {
  let m;
  if ((m = w.match(/^(.*), nearest tithi (\d+)$/))) return t('r.nearest', ruleTerm(m[1]), tithiTerm(+m[2]));
  if ((m = w.match(/^tithi (\d+)$/))) return tithiTerm(+m[1]);
  if ((m = w.match(/^(.+) in ([\w-]+)$/))) return t('r.in', ruleTerm(m[1]), monthOrSign(m[2]));
  if ((m = w.match(/^([\w-]+) before ([\w-]+)$/))) return t('r.before', ruleTerm(m[1]), eventName(m[2]));
  if (pack.names.nakshatras?.[w]) return name('nakshatras', w);
  return w.replace(/_/g, ' ');
}
const monthOrSign = k => pack.names.lunarMonths?.[k] ? name('lunarMonths', k) : pack.names.solarMonths?.[k] ? name('solarMonths', k) : name('rashis', k);
const eventName = id => { const f = pack.festivals.find(f => f.id === id); return f ? fname(f) : recName(id); };
function explainHow(how) {
  if (!how) return '';
  let m, tail = '';
  if ((m = how.match(/^(.*) on a (\w+)$/))) { how = m[1]; tail = ' ' + t('r.onWeekday', name('weekdays', m[2])); }
  const kala = k => STR['rk.' + k] ? t('rk.' + k) : k;
  const dv = name('tithis', 'dvadashi');
  const rules = [
    [/^(.*) prevails from arunodaya; kept that day by the Vaishnava rule$/, m => t('r.vPure', ruleTerm(m[1]))],
    [/^(.*) is touched by Dashami at arunodaya; kept the next day by the Vaishnava rule$/, m => t('r.vViddha', ruleTerm(m[1]), name('tithis', 'dashami'))],
    [/^(.*) prevails at two sunrises; kept on the second by the Vaishnava rule$/, m => t('r.vTwo', ruleTerm(m[1]))],
    [/^(.*) sees no sunrise; kept the next day by the Vaishnava rule$/, m => t('r.vNone', ruleTerm(m[1]))],
    [/^(.*) prevails at two sunrises; observed on the second, with Dvadashi for parana$/, m => t('r.ekSecond', ruleTerm(m[1]), dv)],
    [/^(.*) prevails at two sunrises; observed on the first$/, m => t('r.ekFirst', ruleTerm(m[1]))],
    [/^(.*) prevails at sunrise, but Dvadashi ends before the next sunrise; observed the day before$/, m => t('r.ekBefore', ruleTerm(m[1]), dv)],
    [/^(.*) sees no sunrise; observed the day it begins$/, m => t('r.noSunrise', ruleTerm(m[1]))],
    [/^(.*) does not reach ([\w-]+); observed by sunrise$/, m => t('r.notReach', ruleTerm(m[1]), kala(m[2]))],
    [/^(.*) does not qualify on any day; observed the day it begins$/, m => t('r.begins', ruleTerm(m[1]))],
    [/^(.*) prevails at ([\w-]+)$/, m => t('r.prevails', ruleTerm(m[1]), kala(m[2]))],
    [/^([\w-]+) day (\d+) by its own day rule$/, m => t('r.ownDay', monthOrSign(m[1]), m[2])],
    [/^(\w+) on or before ([\w-]+)$/, m => t('r.onOrBefore', name('weekdays', m[1]), eventName(m[2]))],
    [/^([\w-]+) day (\d+)$/, m => t('r.monthDay', monthOrSign(m[1]), m[2])],
    [/^every (\w+)$/, m => t('r.every', name('weekdays', m[1]))],
    [/^-1 (\w+)$/, m => t('r.last', name('weekdays', m[1]))],
    [/^(\d+) (\w+)$/, m => t('r.nth', m[1], name('weekdays', m[2]))],
    [/^fixed Gregorian date$/, () => t('r.fixed')],
    [/^almanac exception for this year$/, () => t('r.exception')],
    [/^([+-]\d+) days from ([\w-]+)$/, m => t(+m[1] < 0 ? 'r.dayBefore' : 'r.after', Math.abs(+m[1]), eventName(m[2]))],
  ];
  for (const [re, f] of rules) if ((m = how.match(re))) return f(m) + tail;
  return how + tail;
}

// ---------------------------------------------------------------- festival page
async function festivalSheet(id, date) {
  const f = pack.festivals.find(x => x.id === id); if (!f) return;
  const handle = await cal(+date.slice(0, 4));
  const [p, w, occ] = await Promise.all([day(date), engine({ op: 'window', handle, id, date }), engine({ op: 'festivals', handle })]);
  const how = occ.find(o => o.id === id && o.date === date)?.how || '';
  // An Ekadashi's parana the next morning; the moonrise for fasts kept until the moon is seen.
  const parana = /ekadas/.test(id) ? await engine({ op: 'parana', handle, date }).catch(() => null) : null;
  const byMoon = /karva|karwa|sankashti|sankatahara|chauth|chandra-darshan|ganesh-chaturthi/.test(id) && p.moonrise && w?.kala !== 'moonrise';
  const steps = f.content?.howTo ? (f.content.howTo[lang()] ?? f.content.howTo.en ?? []) : [];
  sheet(`<div style="clear:both"></div>
    ${f.tier === 'major' ? `<span class="pill">${esc(t('f.major'))}</span>` : ''}${isHoliday(f) ? `<span class="pill">${esc(t('f.holiday'))}</span>` : ''}
    <h1 class="serif" style="margin:6px 0 0">${esc(fname(f))}</h1><div class="muted">${esc(fother(f))}</div>
    <div style="color:var(--accent);font-weight:700;margin-top:6px">${esc(greg(date))}</div>
    <div class="small muted">📍 ${esc(t('f.forPlace', S.home.name))} · ${esc(cultureDate(p.solar, keptLunar(f, p.lunar)))}</div>
    <p>${esc(text(f.content?.summary))}</p>
    ${w ? `<div class="card"><p class="label">${esc(t('f.pujaTime'))}</p><div>${esc(t('f.keptAt', t('k.' + w.kala)))}</div><div style="font-size:20px;font-weight:700;color:var(--accent)">${esc(w.start === w.end ? clock(w.start) : span(w))}</div><div class="small muted">${esc(t('f.pujaFor', S.home.name))}</div></div>` : ''}
    ${parana ? `<div class="card"><p class="label">${esc(t('v.parana'))}</p><div class="small" style="color:var(--accent);font-weight:700">${esc(greg(addDays(date, 1), { weekday: 'short', day: 'numeric', month: 'short' }))}</div><div style="font-size:20px;font-weight:700">${esc(span(parana))}</div>${parana.dvadashiEnd ? `<div class="small muted">${esc(t('v.dvadashiEnds', clock(parana.dvadashiEnd)))}</div>` : ''}<div class="small muted">${esc(t('v.paranaWhy'))}</div></div>` : ''}
    ${byMoon ? `<div class="card"><p class="label">${esc(t('sun.moonrise'))}</p><div style="font-size:20px;font-weight:700;color:var(--accent)">${esc(clock(p.moonrise))}</div><div class="small muted">${esc(t('f.pujaFor', S.home.name))}</div></div>` : ''}
    ${f.content?.traditions ? `<div class="card"><p class="label">${esc(t('f.traditions'))}</p><p>${esc(text(f.content.traditions))}</p></div>` : ''}
    ${f.local?.[S.home?.country] ? `<div class="card"><p class="label">${esc(t('f.whereYouLive'))}</p><p>${esc((lang() !== 'en' && f.localNative?.[S.home.country]) || f.local[S.home.country])}</p></div>` : ''}
    ${f.content?.story ? `<div class="card"><p class="label">${esc(t('f.story'))}</p><p>${esc(text(f.content.story))}</p></div>` : ''}
    ${steps.length ? `<div class="card"><p class="label">${esc(t('f.howTo'))}</p><ol>${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>` : ''}
    ${f.variations?.length ? `<div class="card"><p class="label">${esc(t('f.notes'))}</p>${(lang() !== 'en' && f.variationsNative?.length ? f.variationsNative : f.variations).map(v => `<p class="small">${esc(v)}</p>`).join('')}</div>` : ''}
    ${how ? `<div class="card"><p class="label">${esc(t('f.dateHow'))}</p><p class="small muted">${esc(explainHow(how))}</p></div>` : ''}
    <button class="btn soft block noprint" onclick="window.print()">${SHARE_ICON} ${esc(t('pdf.share'))}</button>`);
}

// ---------------------------------------------------------------- month
// A date in the month, as on iOS (DaySummarySheet): its limbs, the star line, festivals,
// the best window and Rahu Kalam; one way on to the full day.
async function daySummary(d, place) {
  const [p, fine] = await Promise.all([day(d, place), engine({ op: 'timings', handle: await cal(+d.slice(0, 4), place), date: d }).catch(() => null)]);
  const sp = starPerson(), n0 = p.nakshatras[0], tr = sp && n0 ? taraOf(sp.anchor.nakshatra, n0.key) : 0;
  const fs = p.occurrences.filter(o => !o.recurring).map(o => pack.festivals.find(f => f.id === o.id)).filter(f => f && !f.hidden);
  const best = fine?.choghadiya.find(x => !x.night && ['amrita', 'shubha', 'labha'].includes(x.key));
  const row = (k, v) => `<div class="row"><span class="muted">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
  const o = sheet(`<div class="muted">${esc(greg(d))}</div><h2 class="serif" style="margin:4px 0 10px">${esc(cultureDate(p.solar, p.lunar))}</h2>
    ${row(t('p.tithi'), p.tithis[0] ? name('tithis', p.tithis[0].key) + ' · ' + t('p.until', clock(p.tithis[0].end)) : '–')}
    ${row(t('p.nakshatra'), n0 ? name('nakshatras', n0.key) + ' · ' + t('p.until', clock(n0.end)) : '–')}
    ${tr ? `<p><i class="ringdot rb${taraBand(tr)}"></i> ${esc(t('cal.why', t('taraN.' + tr), sp.name))}</p>` : ''}
    ${fs.map(f => `<p><span class="fdot on" style="display:inline-block"></span> <b>${esc(fname(f))}</b> ${isHoliday(f) ? `<span class="pill">${esc(t('f.holiday'))}</span>` : ''}</p>`).join('')}
    ${best ? row(t('cal.best'), `${name('choghadiya', best.key)} · ${clock(best.start)} – ${clock(best.end)}`) : p.weekday !== 'wednesday' ? row(t('cal.best'), `${t('time.abhijit')} · ${span(p.abhijit)}`) : ''}
    <p class="small muted">${esc(t('time.rahu'))} ${esc(span(p.rahuKalam))}</p>
    <button class="btn block" data-view>${esc(t('cal.viewDay'))}</button>`);
  o.querySelector('[data-view]').onclick = () => { o.remove(); dayDate = d; dayPlace = monthPlace; tab = 'today'; render(); };
}
async function viewMonth() {
  const m = monthDate || today().slice(0, 8) + '01';
  loading();
  const [y, mo] = m.split('-').map(Number);
  const last = `${y}-${pad(mo)}-${pad(new Date(Date.UTC(y, mo, 0)).getUTCDate())}`;
  const place = monthPlace || S.home;
  const cells = await engine({ op: 'month', handle: await cal(y, place), from: m, to: last });
  const solar = pack.display.primary === 'solar';
  const head = [...new Set(cells.map(c => solar ? name('solarMonths', c.solar?.month) : (c.lunar?.adhika ? name('adhika', 'adhika') + ' ' : '') + name('lunarMonths', c.lunar?.month)))].join(' – ');
  // One syllable in Indian scripts, two letters in English; muted, no day coloured apart.
  const wd = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(k => {
    const n = name('weekdays', k); if (lang() === 'en') return n.slice(0, 2);
    return [...new Intl.Segmenter().segment(n)][0]?.segment || n;
  });
  const lead = parse(m).getUTCDay(), td = today(place.tz), sp = starPerson();
  const yl = yearLabel((await day(m, place)).year);
  const marked = ['ekadashi', 'purnima', 'pournami', 'amavasya', 'amavasai', 'karuthavavu'];
  const items = [];
  // Udayam and astamayam for the cell's foot: "6:26", without the half of the day.
  const sunF = dtf({ hour: 'numeric', minute: '2-digit', ...hourOpts(), timeZone: place.tz });
  const hm = u => u ? sunF.formatToParts(new Date(u * 1000)).filter(x => x.type !== 'dayPeriod').map(x => x.value).join('').trim() : '';
  const grid = cells.map(c => {
    const fs = c.festivals.map(id => pack.festivals.find(f => f.id === id)).filter(f => f && !f.hidden);
    fs.forEach(f => items.push({ f, date: c.date }));
    const major = fs.some(f => f.tier === 'major'), special = c.recurring.some(r => marked.includes(r));
    const sub = solar && c.solar ? String(c.solar.day) : name('tithis', c.tithi);
    // Five things only: the date, the tradition's day, the star ring, a moon on Purnima/Amavasya, a festival dot.
    const tr = sp ? taraOf(sp.anchor.nakshatra, c.nakshatra) : 0, band = tr ? taraBand(tr) : -1;
    const moon = c.tithi === 'purnima' ? '●' : c.tithi === 'amavasya' ? '○' : '';
    const why = tr ? ', ' + t('cal.why', t('taraN.' + tr), sp.name) : '';
    // Festive and classic: the celebration's emblem, faint behind the date.
    const cs = S.calStyle || 'festive', top = fs.slice().sort((a, b) => (a.tier === 'major' ? 0 : 1) - (b.tier === 'major' ? 0 : 1))[0];
    const emb = cs !== 'minimal' && top ? ` emb ${top.tier === 'major' ? 'embmaj' : ''}" style="--emb:url(emblems/${top.card || 'lotus'}.svg)` : '';
    return `<button class="c2 cs-${cs} ${c.date === td ? 'today' : ''}${emb}" data-day="${c.date}" aria-label="${esc(greg(c.date) + ', ' + sub + (fs.length ? ', ' + fs.map(fname).join(', ') : '') + why)}">
      <span class="top"><b class="num">${+c.date.slice(8)}</b>${moon ? `<i class="moon">${moon}</i>` : ''}${top ? `<span class="t td ${top.tier === 'major' ? 'maj' : ''}">${esc(sub)}</span>` : ''}<span class="grow"></span>${band === 0 ? '<i class="mk" title="✦">✦</i>' : band === 1 ? '<i class="mk">✪</i>' : ''}</span>
      ${top ? `<span class="fn ${top.tier === 'major' ? 'maj' : ''}">${esc(fname(top))}</span>` : `<span class="t">${esc(sub)}</span>${cs !== 'minimal' ? `<span class="n">${esc(name('nakshatras', c.nakshatra))}</span>` : ''}`}
      ${cs !== 'minimal' && c.sunrise ? `<span class="sun" aria-hidden="true">↑${esc(hm(c.sunrise))} ↓${esc(hm(c.sunset))}</span>` : ''}</button>`;
  }).join('');
  $('#main').innerHTML = `<div class="dayhead"><div class="nav"><button class="arrow" data-m="-1">‹</button>
      <div><button class="mtitle" data-jump><h1 class="serif" style="font-size:24px;margin:0">${esc(head)}</h1><div class="muted">${esc(dtf({ month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(m)))}</div>${yl ? `<div class="small muted">${esc(yl)}</div>` : ''}</button>
      <select id="calstyle" class="placechip noprint" aria-label="${esc(t('cs.title'))}">${[['festive', 'cs.festive'], ['minimal', 'cs.minimal'], ['classic', 'cs.classic']].map(([v, k]) => `<option value="${v}" ${(S.calStyle || 'festive') === v ? 'selected' : ''}>🎨 ${esc(t(k))}</option>`).join('')}</select>
      ${m !== today().slice(0, 8) + '01' ? `<button class="btn" data-mtoday style="padding:3px 12px;font-size:13px">${esc(t('day.today'))}</button>` : ''}
      <select class="placechip noprint" aria-label="${esc(t('cal.location'))}"><option value="home" ${!monthPlace ? 'selected' : ''}>📍 ${esc(S.home.name)}</option>
        ${monthPlace ? `<option value="other" selected>📍 ${esc(monthPlace.name)}</option>` : ''}<option value="pick">${esc(t('cal.other'))}</option></select></div>
      <button class="arrow" data-m="1">›</button></div></div>
    ${S.pdfWatermark !== false ? `<div class="printmark"><img alt="" src="emblems-print/${(items.find(x => x.f.tier === 'major') || items[0])?.f.card || 'lotus'}.svg"></div>` : ''}
    <div class="grid g2 fadein">${wd.map(w => `<div class="wd">${esc(w)}</div>`).join('')}${'<div></div>'.repeat(lead)}${grid}</div>
    <div class="small muted calleg">${sp ? `<div><span><b class="mk">✦</b> ${esc(t('cal.ring0'))}</span><span><b class="mk">✪</b> ${esc(t('cal.ring1'))}</span></div>
      <label>👤 <select id="ringfor">${S.people.filter(p => p.kind !== 'remembrance' && p.anchor?.nakshatra).map(p => `<option value="${p.id}" ${p.id === sp.id ? 'selected' : ''}>${esc(t('cal.for', p.name))}</option>`).join('')}</select></label>` : `<div>${esc(t('cal.addStar'))}</div>`}
      <div><span>↑ ↓ ${esc(t('cal.sunLegend'))}</span><span><i class="fd"></i>${esc(t('tab.festivals'))}</span><span>● ${esc(name('tithis', 'purnima'))}</span><span>○ ${esc(name('tithis', 'amavasya'))}</span></div></div>
    <p class="small muted" style="margin-top:10px;display:none"><span class="dot major"></span> ${esc(t('f.major'))} &nbsp; <span class="dot"></span> ${esc(t('tab.festivals'))} &nbsp; <span class="dot hollow"></span> ${['ekadashi', 'purnima', 'amavasya'].map(k => esc(name('tithis', k))).join(' · ')}</p>
    ${items.length ? `<p class="label" style="margin-top:16px">${esc(t('tab.festivals'))}</p>` : ''}
    ${items.map(x => festRow(x.f, x.date)).join('')}
    <div class="noprint" style="display:flex;gap:8px"><button class="btn soft" style="flex:1" onclick="window.print()">${SHARE_ICON} ${esc(t('pdf.month'))}</button><button class="btn soft" style="flex:1" data-year>${SHARE_ICON} ${esc(t('pdf.year'))}</button></div>`;
  $('#main').querySelector('[data-year]').onclick = () => printYear(y, place);
  $('#main').querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    const d = parse(m); d.setUTCMonth(d.getUTCMonth() + +b.dataset.m, 1); monthDate = ymd(d); viewMonth();
  });
  $('#main').querySelectorAll('[data-day]').forEach(c => c.onclick = () => daySummary(c.dataset.day, place));
  $('#main').querySelector('#calstyle').onchange = e => { S.calStyle = e.target.value; save(); viewMonth(); };
  $('#main').querySelector('#ringfor')?.addEventListener('change', e => { S.starPerson = e.target.value; save(); viewMonth(); });
  $('#main').querySelector('[data-mtoday]')?.addEventListener('click', () => { monthDate = null; viewMonth(); });
  // Tap the title to jump to any month.
  $('#main').querySelector('[data-jump]').onclick = () => {
    const o = sheet(`<h2 class="serif">${esc(t('cal.jump'))}</h2><input type="month" id="mj" value="${m.slice(0, 7)}" style="font-size:18px;padding:8px"><button class="btn block" data-go2 style="margin-top:12px">${esc(t('c.done'))}</button>`);
    o.querySelector('[data-go2]').onclick = () => { const v = o.querySelector('#mj').value; if (v) monthDate = v + '-01'; o.remove(); viewMonth(); };
  };
  $('#main').querySelector('.placechip').onchange = e => {
    if (e.target.value === 'home') { monthPlace = null; viewMonth(); }
    else if (e.target.value === 'pick') {
      const o = sheet(`<h2 class="serif">${esc(t('cal.other'))}</h2><div id="mp"></div>`, o => placePicker(o.querySelector('#mp'), p => { monthPlace = p; o.remove(); viewMonth(); }));
    }
  };
  wireFestivals();
}
// As on iOS (PDFExport.year): the year's festivals, then each month as a grid,
// in the tradition's names - printed (or saved as PDF) from the browser.
async function printYear(y, place) {
  loading();
  const cells = await engine({ op: 'month', handle: await cal(y, place), from: `${y}-01-01`, to: `${y}-12-31` });
  const solar = pack.display.primary === 'solar';
  const c = CULTURES.find(c => c.id === S.culture);
  const title = t('pdf.yearTitle', c ? (S.native ? c.native : c.en) : 'Eka Panchang', y);
  const fests = cells.flatMap(x => x.festivals.map(id => pack.festivals.find(f => f.id === id)).filter(f => f && !f.hidden && f.tier !== 'minor').map(f => ({ f, date: x.date })));
  const wd = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(k => name('weekdays', k).slice(0, lang() === 'en' ? 3 : 4));
  let html = `<div class="yearprint"><h1 class="serif">${esc(title)}</h1><p class="small muted">${esc(t('f.forPlace', place.name))}</p>${fests.map(x => festRow(x.f, x.date)).join('')}`;
  for (let mo = 1; mo <= 12; mo++) {
    const mc = cells.filter(x => +x.date.slice(5, 7) === mo);
    const head = [...new Set(mc.map(x => solar ? name('solarMonths', x.solar?.month) : name('lunarMonths', x.lunar?.month)))].join(' – ');
    const lead = parse(`${y}-${pad(mo)}-01`).getUTCDay();
    html += `<section class="ym"><h2 class="serif">${esc(head)}</h2><div class="muted">${esc(dtf({ month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(`${y}-${pad(mo)}-01`)))}</div>
      <div class="grid">${wd.map(w => `<div class="wd">${esc(w)}</div>`).join('')}${'<div class="cell empty"></div>'.repeat(lead)}${mc.map(x => {
        const fs = x.festivals.map(id => pack.festivals.find(f => f.id === id)).filter(f => f && !f.hidden);
        return `<div class="cell ${fs.length ? 'fest' : ''}"><div class="d">${+x.date.slice(8)}</div><div class="t">${esc(solar && x.solar ? String(x.solar.day) : name('tithis', x.tithi))}</div><div class="n">${esc(name('nakshatras', x.nakshatra))}</div>${fs.slice(0, 2).map(f => `<div class="n" style="color:var(--accent)">${esc(fname(f))}</div>`).join('')}</div>`;
      }).join('')}</div></section>`;
  }
  $('#main').innerHTML = html + `<p class="small muted">${esc(t('pdf.watermark'))}</p></div><button class="btn soft block noprint" data-back>‹ ${esc(t('tab.calendar'))}</button>`;
  $('#main').querySelector('[data-back]').onclick = () => viewMonth();
  setTimeout(() => window.print(), 300);
}

function festRow(f, date) {
  const n = daysBetween(today(), date);
  return `<div class="fest ${f.tier === 'major' ? 'major' : ''}" data-f="${esc(f.id)}" data-d="${date}"><div class="bar2"></div>
    <div style="min-width:44px;text-align:center"><b>${+date.slice(8)}</b><div class="small muted">${esc(dtf({ month: 'short', timeZone: 'UTC' }).format(parse(date)))}</div></div>
    <div><b>${esc(fname(f))}</b><div class="small muted">${esc(fother(f))}</div></div>
    <div class="when">${n === 0 ? esc(t('day.today')) : n === 1 ? esc(t('day.tomorrow')) : n > 1 ? esc(t('day.inDays', n)) : ''}</div></div>`;
}

// ---------------------------------------------------------------- festivals
let majorOnly = true, fKind = null;
async function viewFestivals() {
  loading();
  const KINDS = { major: f => f.tier !== 'minor', regional: f => f.tier === 'regional', fasting: f => /ekadas|vrat|nombu|shivaratri|sankashti|sankatahara|karva|karwa|teej|chhath|upavas|nirjala|pradosh|jitiya|ahoi|chauth/.test(f.id),
    jayanti: f => /jayant|janmotsav|janmashtami|aradhana|rama-navami|ram-navami|ramnavami/.test(f.id), all: () => true };
  const kind = fKind || (majorOnly ? 'major' : 'all');
  const list = (await upcoming(today(), 370)).filter(x => KINDS[kind](x.f));
  // Under All, the recurring observances too, date only (as on iOS: weekly vrats only if kept,
  // a plain Ekadashi left out where a named one falls the same day).
  if (kind === 'all') {
    const from = today(), to = addDays(from, 370), named = new Set(list.filter(x => x.f.id.includes('ekadashi')).map(x => x.date)), seen = new Set();
    for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) {
      for (const o of await engine({ op: 'observances', handle: await cal(y) })) {
        const r = pack.dailySignificance.find(d => d.key === o.id);
        if (o.date < from || o.date > to || (r?.optIn && !S.vrats.includes(o.id))) continue;
        if (o.id.startsWith('ekadashi') && named.has(o.date)) continue;
        if (seen.has(o.id + o.date)) continue;
        seen.add(o.id + o.date); list.push({ obs: o.id, date: o.date });
      }
    }
    list.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.obs ? 1 : 0) - (b.obs ? 1 : 0));
  }
  // Quiet chips: the chosen kind filled, the rest outlined.
  let html = `<div class="chips noprint fkinds" style="margin-bottom:12px">${[['major', 'f.major'], ['regional', 'ff.regional'], ['fasting', 'ff.fasting'], ['jayanti', 'ff.jayanti'], ['all', 'f.all']].map(([k, l]) => `<button class="chip ${kind === k ? 'on' : ''}" data-fk="${k}">${esc(t(l))}</button>`).join('')}</div>`;
  let month = '';
  for (const x of list) {
    const mm = x.date.slice(0, 7);
    if (mm !== month) { month = mm; html += `<p class="label" style="margin-top:14px">${esc(dtf({ month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(x.date)))}</p>`; }
    html += x.obs ? `<div class="list-row obs"><span style="color:var(--gold)">☾</span><span class="grow">${esc(recName(x.obs))}</span><span class="small muted">${esc(dtf({ day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parse(x.date)))}</span></div>` : festRow(x.f, x.date);
  }
  $('#main').innerHTML = html + `<button class="btn soft block noprint" onclick="window.print()">${SHARE_ICON} ${esc(t('pdf.share'))}</button>`;
  $('#main').querySelectorAll('[data-fk]').forEach(b => b.onclick = () => { fKind = b.dataset.fk; viewFestivals(); });
  wireFestivals();
}

// ---------------------------------------------------------------- people
async function anchorFor(date, minutes, place) {
  return engine({ op: 'anchor', date, minutes: minutes ?? undefined, location: place, pack: packJson });
}
function natalLine(a) {
  if (!a) return '';
  const parts = [name('nakshatras', a.nakshatra) + (a.pada ? ' ' + t('bs.pada', a.pada) : ''), t('m.moonIn', name('rashis', a.moonSign))];
  if (a.lagna) parts.push(t('m.lagnaOf', name('rashis', a.lagna)));
  return parts.join(' · ');
}
async function peopleOn(date) {
  const out = [];
  for (const p of S.people.filter(p => p.kind !== 'remembrance-hidden')) {
    if (!p.anchor) continue;
    const ds = await engine({ op: 'personalDates', handle: await cal(+date.slice(0, 4)), anchor: p.anchor, kind: p.kind || 'birthday', basis: p.basis }).catch(() => []);
    if (ds.includes(date)) out.push({ title: t(p.kind === 'remembrance' ? 'pp.remembranceOf' : 'pp.birthdayOf', p.name), line: natalLine(p.anchor) });
  }
  return out;
}
async function viewPeople() {
  loading();
  const rows = [];
  for (const p of S.people) {
    let next = '';
    for (const y of [+today().slice(0, 4), +today().slice(0, 4) + 1]) {
      const ds = p.anchor ? await engine({ op: 'personalDates', handle: await cal(y), anchor: p.anchor, kind: p.kind || 'birthday', basis: p.basis }).catch(() => []) : [];
      next = ds.find(d => d >= today()); if (next) break;
    }
    rows.push(`<div class="list-row"><div class="grow"><b>${esc(t(p.kind === 'remembrance' ? 'pp.remembranceOf' : 'pp.birthdayOf', p.name))}</b> <span class="small" style="color:var(--accent);font-weight:700">${p.relation ? esc(t('rel.' + p.relation)) : ''}</span>
      <div class="small muted">${esc(natalLine(p.anchor))}</div>${next ? `<div class="small" style="color:var(--accent)">${esc(greg(next))}</div>` : ''}</div>
      <button class="btn soft" data-edit="${p.id}">${esc(t('c.edit'))}</button></div>`);
  }
  adoptFamilyless();
  const groups = [...S.families.map(f => [f.name, S.people.map((p, i) => [p, rows[i]]).filter(([p]) => p.family === f.id)])].filter(([, l]) => l.length);
  $('#main').innerHTML = `<p class="label">${esc(t('pp.title'))}</p><p class="small muted">${esc(t('pp.intro'))}</p>
    ${groups.map(([n, l]) => `<div class="card"><p class="label">${esc(n)}</p>${l.map(([, r]) => r).join('')}</div>`).join('')}
    <button class="btn block" data-add>＋ ${esc(t('pp.add'))}</button>`;
  $('#main').querySelector('[data-add]').onclick = () => personEditor(null);
  $('#main').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => personEditor(S.people.find(p => p.id === b.dataset.edit)));
}
function personEditor(person, presetSex, onSaved) {
  const p = Object.assign({ _seq: 0 }, person || { id: crypto.randomUUID(), name: '', sex: presetSex || '', kind: 'birthday', date: '', minutes: null, place: S.home });
  const o = sheet(`<h2 class="serif">${esc(person ? p.name : t('pp.add'))}</h2>
    <label class="field"><span>${esc(t('pp.name'))}</span><input type="text" id="pn" value="${esc(p.name)}"></label>
    <div class="field"><span>${esc(t('fam.family'))}</span><select id="pfam">${S.families.map(f => `<option value="${f.id}" ${f.id === (p.family || S.families[0]?.id) ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
      ${S.families.length ? '' : `<option value="" selected>${esc(t('fam.default'))}</option>`}<option value="+">＋ ${esc(t('fam.new'))}</option></select></div>
    <label class="field"><span>${esc(t('fam.relation'))}</span><select id="prel"><option value="">–</option>${RELATIONS.map(r => `<option value="${r}" ${p.relation === r ? 'selected' : ''}>${esc(t('rel.' + r))}</option>`).join('')}</select></label>
    <div class="field"><span>${esc(t('pp.sex'))}</span><div class="seg"><button data-sex="female" class="${p.sex === 'female' ? 'on' : ''}">${esc(t('pp.female'))}</button><button data-sex="male" class="${p.sex === 'male' ? 'on' : ''}">${esc(t('pp.male'))}</button></div></div>
    <div class="field"><span>${esc(t('pp.kind'))}</span><div class="seg"><button data-kind="birthday" class="${p.kind !== 'remembrance' ? 'on' : ''}">${esc(t('pp.birthday'))}</button><button data-kind="remembrance" class="${p.kind === 'remembrance' ? 'on' : ''}">${esc(t('pp.remembrance'))}</button></div></div>
    <label class="field"><span>${esc(t('pp.born'))}</span><input type="date" id="pd" min="1900-01-01" max="${today()}" value="${esc(p.date)}"></label>
    <label class="field"><span>${esc(t('pp.time'))}</span><input type="time" id="pt" value="${p.minutes != null ? pad(Math.floor(p.minutes / 60)) + ':' + pad(p.minutes % 60) : ''}"></label>
    <div class="field"><span>${esc(t('pp.place'))}: <b id="pplace">${esc(p.place?.name || '')}</b></span><div id="ppick"></div></div>
    <div class="card" id="preview"></div>
    <div class="small muted">${esc(t('pp.timeNote'))}</div>
    <p id="perr" class="small" style="color:var(--accent);font-weight:700;margin:10px 0 0"></p>
    <button class="btn block" id="psave" style="margin-top:12px">${esc(t('c.save'))}</button>
    ${person ? `<button class="btn soft block" id="pdel" style="margin-top:8px">${esc(t('pp.delete'))}</button>` : ''}`, o2 => {
      const q = s => o2.querySelector(s);
  // From Matching or Muhurtham only the birth matters: family, relation and kind stay optional and out of the way.
  if (!person && presetSex) ['#pfam', '#prel', '[data-kind]'].forEach(sel => o.querySelector(sel)?.closest('.field')?.setAttribute('hidden', ''));
      const preview = async () => {
        const d = q('#pd').value; if (!d || !p.place) { q('#preview').innerHTML = `<span class="small muted">${esc(t('bs.choosePlace'))}</span>`; return; }
        const tm = q('#pt').value; const minutes = tm ? +tm.slice(0, 2) * 60 + +tm.slice(3) : null;
        // The same inputs read once: Save does not compute them again.
        const key = `${d}|${minutes}|${p.place.latitude}|${p.place.longitude}`;
        if (p._anchor && p._key === key) { q('#preview').innerHTML = anchorCard(p._anchor); return; }
        q('#preview').innerHTML = '<div class="ring mini"><i></i></div>';
        const mine = ++p._seq;
        try { const a = await anchorFor(d, minutes, p.place); if (mine !== p._seq) return; p._anchor = a; p._minutes = minutes; p._key = key; q('#preview').innerHTML = anchorCard(a); }
        catch (e) { if (mine === p._seq) q('#preview').textContent = t('pp.failed'); }
      };
      o2.querySelectorAll('[data-sex]').forEach(b => b.onclick = () => { p.sex = b.dataset.sex; o2.querySelectorAll('[data-sex]').forEach(x => x.classList.toggle('on', x === b)); });
      q('#prel').onchange = e => { const sx = relationSex(e.target.value); if (sx) { p.sex = sx; o2.querySelectorAll('[data-sex]').forEach(x => x.classList.toggle('on', x.dataset.sex === sx)); } };
      q('#pfam').onchange = e => {
        if (e.target.value !== '+') return;
        const n = (prompt(t('fam.name')) || '').trim();
        if (!n) { e.target.value = S.families[0]?.id || ''; return; }
        const f = { id: crypto.randomUUID(), name: n }; S.families.push(f); save();
        e.target.insertAdjacentHTML('afterbegin', `<option value="${f.id}">${esc(n)}</option>`); e.target.value = f.id;
      };
      o2.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { p.kind = b.dataset.kind; o2.querySelectorAll('[data-kind]').forEach(x => x.classList.toggle('on', x === b)); });
      q('#pd').onchange = preview; q('#pt').onchange = preview;
      placePicker(q('#ppick'), pl => { p.place = pl; q('#pplace').textContent = pl.name; q('#ppick').querySelector('.results').innerHTML = ''; preview(); });
      if (p.date) preview();
      q('#psave').onclick = async () => {
        p.name = q('#pn').value.trim(); p.date = q('#pd').value;
        // Say what is missing in the sheet itself, next to Save.
        const missing = [[!p.name, 'pp.name'], [!p.sex, 'pp.sex'], [!p.date, 'pp.born'], [!p.place, 'pp.place']].filter(x => x[0]).map(x => t(x[1]));
        q('#perr').textContent = missing.length ? '⚠ ' + missing.join(', ') : '';
        if (missing.length) return;
        const btn = q('#psave'); btn.disabled = true; btn.textContent = t('pp.reading'); o2.dataset.busy = '1';
        await preview();
        btn.disabled = false; btn.textContent = t('c.save'); delete o2.dataset.busy;
        if (!p._anchor) { q('#perr').textContent = '⚠ ' + t('pp.failed'); return; }
        const fam = q('#pfam').value && q('#pfam').value !== '+' ? q('#pfam').value : defaultFamily().id;
        const rec = { id: p.id, name: p.name, sex: p.sex, kind: p.kind, date: p.date, minutes: p._minutes ?? null, place: p.place, anchor: p._anchor, family: fam, relation: q('#prel').value || null };
        const i = S.people.findIndex(x => x.id === p.id); if (i >= 0) S.people[i] = rec; else S.people.push(rec);
        save(); o2.remove(); onSaved ? onSaved(rec) : render();
      };
      q('#pdel')?.addEventListener('click', () => { if (confirm(t('pp.deleteConfirm', p.name))) { S.people = S.people.filter(x => x.id !== p.id); save(); o2.remove(); render(); } });
    });
  return o;
}
function anchorCard(a) {
  return `<p class="label">${esc(t('bs.result'))}</p>
    <div class="row"><span class="muted">${esc(t('bs.star'))}</span><span class="v">${esc(name('nakshatras', a.nakshatra))} · ${esc(t('bs.pada', a.pada))}</span></div>
    <div class="row"><span class="muted">${esc(t('bs.moon'))}</span><span class="v">${esc(name('rashis', a.moonSign))}</span></div>
    <div class="row"><span class="muted">${esc(t('bs.lagna'))}</span><span class="v">${esc(a.lagna ? name('rashis', a.lagna) : t('bs.needTime'))}</span></div>
    ${a.moonSignCertain === false ? `<div class="small" style="color:var(--accent)">${esc(t('bs.uncertain'))}</div>` : ''}`;
}

// ---------------------------------------------------------------- nakshatra calculator
function viewBirthStar() {
  let place = S.home;
  $('#main').innerHTML = `<div class="card"><h2 class="serif" style="margin-top:0">${esc(t('bs.title'))}</h2>
    <label class="field"><span>${esc(t('pp.born'))}</span><input type="date" id="bd" min="1900-01-01" max="2100-12-31"></label>
    <label class="field"><span>${esc(t('pp.time'))}</span><input type="time" id="bt"></label>
    <div class="field"><span>${esc(t('pp.place'))}: <b id="bplace">${esc(place.name)}</b></span><div id="bpick"></div></div></div>
    <div class="card" id="bres"><span class="small muted">${esc(t('pp.timeNote'))}</span></div>`;
  let seq = 0;
  const run = async () => {
    const d = $('#bd').value; if (!d) return;
    const tm = $('#bt').value; const minutes = tm ? +tm.slice(0, 2) * 60 + +tm.slice(3) : null;
    const mine = ++seq; $('#bres').innerHTML = `<div class="ring mini"><i></i></div><p class="small muted" style="text-align:center">${esc(t('pp.reading'))}</p>`;
    let html; try { html = anchorCard(await anchorFor(d, minutes, place)); } catch { html = `<p class="small" style="color:var(--accent);font-weight:700">⚠ ${esc(t('pp.failed'))}</p><button class="btn soft" id="bretry">${esc(t('c.retry'))}</button>`; }
    if (mine === seq) { $('#bres').innerHTML = html; $('#bretry')?.addEventListener('click', run); }
  };
  $('#bd').onchange = run; $('#bt').onchange = run;
  placePicker($('#bpick'), p => { place = p; $('#bplace').textContent = p.name; $('#bpick').querySelector('.results').innerHTML = ''; run(); });
}

// ---------------------------------------------------------------- muhurtham
const M = { event: 'marriage', months: 6, bride: '', groom: '', profile: '', results: null, byDate: false };
function viewMuhurtham() {
  const events = pack.muhurtham?.events || [];
  const couple = ['marriage', 'engagement'].includes(M.event);
  const births = S.people.filter(p => p.kind !== 'remembrance' && p.anchor);
  const opt = (list, sel, none) => `${none ? `<option value="">${esc(none)}</option>` : `<option value="">${esc(t('m.choose'))}</option>`}` + list.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(personLabel(p))}</option>`).join('') + `<option value="+">＋ ${esc(t('m.addProfile'))}</option>`;
  const bride = births.find(p => p.id === M.bride), groom = births.find(p => p.id === M.groom);
  const ready = !couple || (bride && groom);
  // As on iOS: occasions by kind, and a browse mode with no inputs.
  const groups = ['family', 'home', 'work', 'travel', 'life'].map(g => [g, events.filter(e => (e.group || 'life') === g)]).filter(([, l]) => l.length);
  const picker = groups.map(([g, l]) => `<p class="label" style="margin-top:12px">${esc(t('m.group.' + g))}</p><div class="chips">${l.map(e => `<button class="chip ${M.event === e.id ? 'on' : ''}" data-ev="${e.id}">${esc(e.names[lang()] ?? e.names.en)}</button>`).join('')}</div>`).join('');
  const mode = `<div class="seg" style="margin:8px 0"><button data-br="0" class="${!M.browse ? 'on' : ''}">${esc(t('m.modeFind'))}</button><button data-br="1" class="${M.browse ? 'on' : ''}">${esc(t('m.modeBrowse'))}</button></div>`;
  if (M.browse) {
    $('#main').innerHTML = `<p class="muted">${esc(t('m.intro'))}</p>${mode}${picker}<p class="small muted" style="margin-top:12px">${esc(t('m.browseNote'))}</p><div id="mres" style="margin-top:14px"></div><p class="small muted">${esc(t('m.lagna'))}</p>`;
    $('#main').querySelectorAll('[data-ev]').forEach(b => b.onclick = () => { M.event = b.dataset.ev; M.results = null; viewMuhurtham(); });
    $('#main').querySelectorAll('[data-br]').forEach(b => b.onclick = () => { M.browse = b.dataset.br === '1'; M.results = null; viewMuhurtham(); });
    if (M.results) return renderResults();
    $('#mres').innerHTML = '<div class="loading"><div class="ring"><i></i></div></div>';
    const from = addDays(today(), 1); const d = parse(from); d.setUTCMonth(d.getUTCMonth() + 12); const to = ymd(d);
    (async () => {
      let out = [];
      for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) out = out.concat(await engine({ op: 'muhurtham', handle: await cal(y), event: M.event, from, to, people: [] }));
      if (!M.browse || tab !== 'muhurtham') return;
      M.results = { list: out.sort((a, b) => a.date < b.date ? -1 : 1), chosen: [], months: true };
      renderResults();
    })();
    return;
  }
  $('#main').innerHTML = `<p class="muted">${esc(t('m.intro'))}</p>${mode}${picker}
    <div class="card" style="margin-top:12px"><p class="label">${esc(t('m.when'))}</p><div class="seg">${[3, 6, 12].map(n => `<button data-mo="${n}" class="${M.months === n ? 'on' : ''}">${esc(t('m.months', n))}</button>`).join('')}</div></div>
    <div class="card"><p class="label">${esc(t(couple ? 'm.couple' : 'm.forWhom'))}</p><p class="small muted">${esc(t('m.jathakamNote'))}</p>
      ${couple ? `<label class="field"><span>${esc(t('m.bride'))}</span><select id="sb">${opt(births.filter(p => p.sex === 'female'), M.bride)}</select><div class="small muted">${esc(natalLine(bride?.anchor))}</div></label>
        <label class="field"><span>${esc(t('m.groom'))}</span><select id="sg">${opt(births.filter(p => p.sex === 'male'), M.groom)}</select><div class="small muted">${esc(natalLine(groom?.anchor))}</div></label>
        ${!ready ? `<div class="small" style="color:var(--accent)">${esc(t('m.needCouple'))}</div>` : matchesByPorutham() ? `<button class="btn soft block" id="por">💞 ${esc(t('pr.open'))}</button>` : GUNA_MILAN_RELEASED ? `<button class="btn soft block" id="gm">💞 ${esc(t('gm.title'))}</button>` : ''}`
      : `<label class="field"><span>${esc(t('m.profile'))}</span><select id="sp">${opt(births, M.profile, t('m.nobody'))}</select></label>`}
      ${[bride, groom].concat(couple ? [] : [births.find(p => p.id === M.profile)]).filter(p => p && !p.anchor?.lagna).map(p => `<div class="small" style="color:var(--accent)">${esc(t('m.noTime', p.name))}</div>`).join('')}
    </div>
    <button class="btn block" id="find" ${ready ? '' : 'disabled'}>${esc(t('m.find'))}</button>
    <div id="mres" style="margin-top:14px"></div>
    <p class="small muted">${esc(t('m.lagna'))}</p>`;
  $('#main').querySelectorAll('[data-ev]').forEach(b => b.onclick = () => { M.event = b.dataset.ev; M.results = null; viewMuhurtham(); });
  $('#main').querySelectorAll('[data-br]').forEach(b => b.onclick = () => { M.browse = b.dataset.br === '1'; M.results = null; viewMuhurtham(); });
  $('#main').querySelectorAll('[data-mo]').forEach(b => b.onclick = () => { M.months = +b.dataset.mo; M.results = null; viewMuhurtham(); });
  const pick = (sel, key, sex) => sel && (sel.onchange = () => {
    if (sel.value === '+') personEditor(null, sex, rec => { M[key] = rec.id; M.results = null; viewMuhurtham(); });
    else { M[key] = sel.value; M.results = null; viewMuhurtham(); }
  });
  pick($('#sb'), 'bride', 'female'); pick($('#sg'), 'groom', 'male'); pick($('#sp'), 'profile', '');
  $('#por')?.addEventListener('click', () => poruthamSheet(bride, groom));
  $('#gm')?.addEventListener('click', () => gunaMilanSheet(bride, groom));
  $('#find').onclick = async () => {
    $('#mres').innerHTML = '<div class="loading"><div class="ring"><i></i></div></div>';
    const from = addDays(today(), 1); const d = parse(from); d.setUTCMonth(d.getUTCMonth() + M.months); const to = ymd(d);
    const chosen = couple ? [bride, groom] : [births.find(p => p.id === M.profile)].filter(Boolean);
    const people = chosen.map(p => ({ nakshatra: p.anchor.nakshatra, moonSign: p.anchor.moonSign, lagna: p.anchor.lagna }));
    let out = [];
    for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) out = out.concat(await engine({ op: 'muhurtham', handle: await cal(y), event: M.event, from, to, people }));
    M.results = { list: out.sort((a, b) => b.score - a.score || (a.date < b.date ? -1 : 1)), chosen };
    renderResults();
  };
  if (M.results) renderResults();
}
function renderResults() {
  const { list, chosen } = M.results;
  const shown = M.byDate || M.results.months ? [...list].sort((a, b) => a.date < b.date ? -1 : 1) : list;
  // Browsing: a heading for each month, with its count.
  const monthHead = (m, i) => {
    if (!M.results.months || (i > 0 && shown[i - 1].date.slice(0, 7) === m.date.slice(0, 7))) return '';
    const n = shown.filter(x => x.date.slice(0, 7) === m.date.slice(0, 7)).length;
    return `<p class="label" style="margin-top:14px">${esc(dtf({ month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(m.date)))} · ${esc(t('m.inMonth', n))}</p>`;
  };
  $('#mres').innerHTML = !list.length ? `<div class="card muted">${esc(t('m.none'))}</div>` : `
    ${M.results.months ? '' : `<div class="seg noprint" style="margin-bottom:8px"><button data-bd="0" class="${!M.byDate ? 'on' : ''}">${esc(t('m.best'))}</button><button data-bd="1" class="${M.byDate ? 'on' : ''}">${esc(t('m.byDate'))}</button></div>`}
    <p class="small muted">${esc(t('m.found', list.length))}</p>
    <button class="btn soft block noprint" onclick="window.print()" style="margin-bottom:10px">${SHARE_ICON} ${esc(t('pdf.share'))}</button>
    ${shown.map((m, i) => `${monthHead(m, i)}<div class="card"><div style="display:flex;justify-content:space-between"><b>${esc(greg(m.date))}</b><span class="small muted">${esc(t('day.inDays', daysBetween(today(), m.date)))}</span></div>
      <div style="color:var(--accent);font-weight:700">${m.windows.map(span).map(esc).join(' · ')}</div>
      ${m.lagnas.length ? `<div class="small">${esc(t('m.lagnas', m.lagnas.map(l => `${name('rashis', l.lagna)} ${clock(l.start)}–${clock(l.end)}`).join(' · ')))}</div>` : ''}
      <div class="small">${esc(t('m.why', m.nakshatras.map(n => name('nakshatras', n)).join(', '), m.tithis.map(tithiName).join(', ')))}</div>
      ${m.abhijit ? `<span class="pill">${esc(t('m.abhijit'))}</span>` : ''}${m.tithis.some(x => x <= 15) ? `<span class="pill">${esc(t('m.waxing'))}</span>` : ''}
      ${chosen.map((p, i) => { const c = m.chandrabala[i]; const q = [1, 3, 6, 7, 10, 11].includes(c) ? 'cb.good' : [4, 12].includes(c) ? 'cb.weak' : 'cb.neutral';
        return `<div class="small muted">${esc(t('m.tara', p.name, t('tara.' + m.taras[i])))}${c ? ' · ' + esc(t('m.chandra', c, name('rashis', p.anchor.moonSign), t(q))) : ''}</div>`; }).join('')}
    </div>`).join('')}
    <p class="small muted">${esc(t('m.excluded'))}</p>`;
  $('#mres').querySelectorAll('[data-bd]').forEach(b => b.onclick = () => { M.byDate = b.dataset.bd === '1'; renderResults(); });
}

// ---------------------------------------------------------------- greetings
// As on iOS (GreetingCard.swift): each festival's card art (cards/<motif>.svg,
// drawn in white and tinted to a palette), names and a message. The web is
// free, so the card is personal, with the Kaal mark at its foot.
const PALETTES = [
  ['#11113E', '#2A1F5C', '#fff', '#E8C25A', '#F3D98C'], ['#B5523B', '#7E2E1E', '#fff', '#FFE2B8', '#FFE9CC'],
  ['#F4A62A', '#E0701B', '#3B1B07', '#7A1F0E', '#FFF3D6'], ['#0D6E6E', '#123E5C', '#fff', '#F0D27A', '#BDE6E0'],
  ['#4A1942', '#2B0F2A', '#fff', '#F2B6D0', '#F6D6E6'], ['#FAF6EF', '#F1E7D6', '#2B2420', '#B5523B', '#C9814F']];
const cardPalette = m => ({ diya: 0, shiva: 0, moon: 0, ayyappa: 0, bonfire: 0, vishnu: 0, pongal: 1, ganesha: 1, murugan: 1, rakhi: 1, swing: 1, chariot: 1, hanuman: 1,
  pookalam: 2, sun: 2, lakshmi: 2, pooram: 2, kite: 2, holi: 3, krishna: 3, newyear: 3, water: 3, boat: 3, tree: 3, tulsi: 3, naga: 3 })[m] ?? 4;
async function viewGreetings() {
  loading();
  const list = (await upcoming(today(), 180)).filter(x => x.f.tier !== 'minor');
  if (tab !== 'greetings') return;
  $('#main').innerHTML = `<h2 class="serif" style="margin:0">${esc(t('gr.title'))}</h2><p class="muted">${esc(t('gr.pick'))}</p>
    <div class="card">${list.map((x, i) => `<div class="list-row" data-g="${i}" style="cursor:pointer"><span class="cardthumb" style="${cardBg(x.f.card, cardPalette(x.f.card))}"><i style="${cardArt(x.f.card, cardPalette(x.f.card))}"></i></span>
      <div class="grow"><b>${esc(fname(x.f))}</b><div class="small muted">${esc(greg(x.date, { day: 'numeric', month: 'short', year: 'numeric' }))}</div></div><span>✉︎</span></div>`).join('')}</div>`;
  $('#main').querySelectorAll('[data-g]').forEach(r => r.onclick = () => cardMaker(list[+r.dataset.g].f, list[+r.dataset.g].date));
}
const cardBg = (m, p) => `background:linear-gradient(${PALETTES[p][0]},${PALETTES[p][1]})`;
const cardArt = (m, p) => `background:${PALETTES[p][4]};-webkit-mask:url(cards/${m || 'lotus'}.svg) center/100% 100%;mask:url(cards/${m || 'lotus'}.svg) center/100% 100%;opacity:.85`;
// Movement over a card, as on iOS (CardMotion.swift): each loops every four seconds.
const MOTIONS = ['still', 'glow', 'petals', 'sparkle', 'rays', 'fireworks'];
const suggestedMotion = m => ({ diya: 'glow', lakshmi: 'glow', shiva: 'glow', bonfire: 'glow', tulsi: 'glow', pookalam: 'petals', holi: 'petals', swing: 'petals', krishna: 'petals', lotus: 'petals', pooram: 'petals',
  sun: 'rays', pongal: 'rays', kite: 'rays', newyear: 'rays', chariot: 'rays' })[m] || 'sparkle';
function drawMotion(g, kind, t, w, h, light, accent) {
  const f = (t / 4) % 1, TAU = Math.PI * 2, seed = (i, k) => { const v = Math.sin((i * 127 + k * 311) * 12.9898) * 43758.5453; return v - Math.floor(v); };
  const dot = (x, y, r, c, a) => { g.globalAlpha = Math.max(0, a); g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  g.save();
  if (kind === 'glow') {
    const b = .5 + .5 * Math.sin(TAU * f), rg = g.createRadialGradient(w / 2, h * .92, 0, w / 2, h * .92, w * .8);
    rg.addColorStop(0, accent); rg.addColorStop(1, 'transparent'); g.globalAlpha = .14 + .14 * b; g.fillStyle = rg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) { const p = (f + seed(i, 1)) % 1; dot(seed(i, 2) * w + Math.sin(TAU * (f * 2 + seed(i, 3))) * 10 * w / 320, h * .95 - p * h * .75, (1.5 + 2 * seed(i, 4)) * w / 320, accent, .9 * Math.sin(Math.PI * p)); }
  } else if (kind === 'petals') {
    for (let i = 0; i < 22; i++) { const p = (f + seed(i, 1)) % 1; g.save(); g.translate(seed(i, 2) * w + Math.sin(TAU * (f * 2 + seed(i, 3))) * 18 * w / 320, p * (h + 40) - 20); g.rotate(TAU * (f + seed(i, 4)));
      g.globalAlpha = .75; g.fillStyle = i % 3 ? accent : light; g.beginPath(); g.ellipse(0, 0, 6 * w / 320, 3 * w / 320, 0, 0, TAU); g.fill(); g.restore(); }
  } else if (kind === 'sparkle') {
    for (let i = 0; i < 26; i++) { const a = Math.max(0, Math.sin(TAU * (f * (1 + i % 2) + seed(i, 5)))), x = seed(i, 6) * w, y = seed(i, 7) * h, r = (3 + 6 * a) * w / 320;
      g.globalAlpha = .85 * a; g.fillStyle = light; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * .25, y - r * .25); g.lineTo(x + r, y); g.lineTo(x + r * .25, y + r * .25); g.lineTo(x, y + r); g.lineTo(x - r * .25, y + r * .25); g.lineTo(x - r, y); g.lineTo(x - r * .25, y - r * .25); g.fill(); }
  } else if (kind === 'rays') {
    const cx = w / 2, cy = h * .12, r = Math.max(w, h) * 1.2; g.globalAlpha = .07; g.fillStyle = light;
    for (let i = 0; i < 16; i++) { const a0 = TAU * (i + f) / 16; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r); g.lineTo(cx + Math.cos(a0 + Math.PI / 32) * r, cy + Math.sin(a0 + Math.PI / 32) * r); g.fill(); }
  } else if (kind === 'fireworks') {
    for (let b = 0; b < 3; b++) { const age = (f + b / 3) % 1, cx = w * (.22 + .28 * b), cy = h * (.18 + .08 * (b % 2)), r = 70 * Math.sqrt(age) * w / 320;
      for (let i = 0; i < 18; i++) { const a = TAU * i / 18; dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r + 20 * age * age * w / 320, 2 * w / 320, b === 1 ? accent : light, .9 * (1 - age)); } }
  }
  g.restore();
}
// Greeting-card designs, as on iOS (GreetingDesigns.swift): stationery-style cards with gold
// borders and filigree, the festival's name in a script face, its emblem, and a tagline.
const DESIGNS = ['classic', 'heritage', 'arch', 'mandala', 'botanical', 'lanterns'];
const suggestedDesign = m => ({ diya: 'lanterns', lakshmi: 'lanterns', newyear: 'lanterns', moon: 'lanterns', lotus: 'botanical', tulsi: 'botanical', pookalam: 'botanical', tree: 'botanical', water: 'botanical', boat: 'botanical',
  navratri: 'mandala', holi: 'mandala', krishna: 'mandala', swing: 'mandala', rakhi: 'mandala', ganesha: 'arch', shiva: 'arch', vishnu: 'arch', rama: 'arch', hanuman: 'arch', murugan: 'arch', ayyappa: 'arch', naga: 'arch', chariot: 'arch', pooram: 'arch' })[m] || 'heritage';
const cardTheme = m => ({ diya: 'light', lakshmi: 'light', shiva: 'light', bonfire: 'light', moon: 'light', vishnu: 'light', pongal: 'harvest', sun: 'harvest', kite: 'harvest', pookalam: 'harvest', tree: 'harvest', boat: 'harvest', water: 'harvest', holi: 'colour', newyear: 'newyear', rakhi: 'bond' })[m] || 'devotion';
const DCOL = { light: { paper: ['#F8F1E3', '#F1E5CF'], ink: '#6E1631', gold: '#B68A33', accent: '#8E1E45', dark: false },
  arch: { paper: ['#9C1450', '#5E0C33'], ink: '#F3D58C', gold: '#E2B85C', accent: '#1F6E73', dark: true },
  mandala: { paper: ['#4A1B3D', '#2E0F27'], ink: '#F0CF83', gold: '#DDB15A', accent: '#E0607E', dark: true } };
const tintCache = {};
async function tintedEmblem(m, a, b) {
  const k = m + a + b; if (tintCache[k]) return tintCache[k];
  const img = new Image(); img.src = `emblems/${m}.svg`; await img.decode().catch(() => {});
  const c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d');
  g.drawImage(img, 0, 0, 360, 360); g.globalCompositeOperation = 'source-in';
  const gr = g.createLinearGradient(0, 0, 0, 360); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 360, 360);
  return tintCache[k] = c;
}
// A text's lines at the canvas's current font, broken between words (a single long word gets a line of its own).
function cardLines(g, s, maxW) {
  const out = []; let cur = '';
  for (const w of String(s).split(' ')) { const nx = cur ? cur + ' ' + w : w; if (g.measureText(nx).width > maxW && cur) { out.push(cur); cur = w; } else cur = nx; }
  if (cur) out.push(cur);
  return out;
}
async function drawDesign(g, W, H, d, f, date, native, line, st) {
  await document.fonts.load(`48px "Great Vibes"`).catch(() => {});
  const C = DCOL[d === 'arch' ? 'arch' : d === 'mandala' ? 'mandala' : 'light'], u = W / 320, TAU = Math.PI * 2;
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, C.paper[0]); bg.addColorStop(1, C.paper[1]); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const rg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * .8); rg.addColorStop(0, C.dark ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const corner = (x, y, rot) => { g.save(); g.translate(x, y); g.rotate(rot); const s = 34 * u; g.beginPath(); g.moveTo(0, s); g.lineTo(0, s * .3); g.quadraticCurveTo(0, 0, s * .3, 0); g.lineTo(s, 0);
    g.moveTo(s * .3, s * .3); g.quadraticCurveTo(s * .5, s * .32, s * .62, s * .12); g.moveTo(s * .3, s * .3); g.quadraticCurveTo(s * .32, s * .5, s * .12, s * .62); g.stroke(); g.beginPath(); g.arc(s * .23, s * .23, s * .07, 0, TAU); g.stroke(); g.restore(); };
  const border = () => { g.strokeStyle = C.gold; g.lineWidth = 1.4 * u; g.strokeRect(12 * u, 12 * u, W - 24 * u, H - 24 * u); g.globalAlpha = .55; g.lineWidth = .6 * u; g.strokeRect(17 * u, 17 * u, W - 34 * u, H - 34 * u); g.globalAlpha = 1;
    g.lineWidth = 1.2 * u; corner(8 * u, 8 * u, 0); corner(W - 8 * u, 8 * u, Math.PI / 2); corner(W - 8 * u, H - 8 * u, Math.PI); corner(8 * u, H - 8 * u, -Math.PI / 2); };
  const petals = (cx, cy, r, rings, fill, stroke) => { for (let ring = 0; ring < rings; ring++) { const len = r * (1 - ring * .22), n = 12 + ring * 4;
      for (let i = 0; i < n; i++) { const a = i / n * TAU + (ring % 2 ? Math.PI / n : 0), b = len * .62, w = len * .16, sd = a + Math.PI / 2, bx = cx + Math.cos(a) * b, by = cy + Math.sin(a) * b;
        g.beginPath(); g.moveTo(bx + Math.cos(sd) * w, by + Math.sin(sd) * w); g.quadraticCurveTo(bx + Math.cos(sd) * w * 1.4 + Math.cos(a) * len * .2, by + Math.sin(sd) * w * 1.4 + Math.sin(a) * len * .2, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        g.quadraticCurveTo(bx - Math.cos(sd) * w * 1.4 + Math.cos(a) * len * .2, by - Math.sin(sd) * w * 1.4 + Math.sin(a) * len * .2, bx - Math.cos(sd) * w, by - Math.sin(sd) * w); g.closePath();
        if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.stroke(); } } } };
  const arch = (p) => { const x0 = p, y0 = p, x1 = W - p, y1 = H - p, h = y1 - y0, w = x1 - x0, sp = y0 + h * .24, mx = (x0 + x1) / 2;
    g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, sp); g.bezierCurveTo(x0, y0 + h * .08, mx - w * .12, y0 + h * .1, mx, y0); g.bezierCurveTo(mx + w * .12, y0 + h * .1, x1, y0 + h * .08, x1, sp); g.lineTo(x1, y1); g.closePath(); };
  const lantern = (x, y, w, h, a) => { g.globalAlpha = a; g.fillStyle = C.gold; g.fillRect(x - .6 * u, y - h / 2, 1.2 * u, h * .42); const top = y - h / 2 + h * .42;
    g.fillRect(x - w * .22, top, w * .44, h * .05); g.beginPath(); g.moveTo(x - w * .22, top + h * .05); g.bezierCurveTo(x - w * .55, top + h * .12, x - w * .55, top + h * .32, x - w * .2, top + h * .38); g.lineTo(x + w * .2, top + h * .38);
    g.bezierCurveTo(x + w * .55, top + h * .32, x + w * .55, top + h * .12, x + w * .22, top + h * .05); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x - w * .12, top + h * .38); g.lineTo(x, y + h / 2); g.lineTo(x + w * .12, top + h * .38); g.fill(); g.globalAlpha = 1; };
  if (d === 'heritage' || d === 'lanterns') border();
  if (d === 'lanterns') { for (const x of [.12, .88]) lantern(W * x, 64 * u, 26 * u, 92 * u, .9); for (const x of [.27, .73]) lantern(W * x, 40 * u, 16 * u, 58 * u, .7); }
  if (d === 'arch') { g.fillStyle = 'rgba(31,110,115,.55)'; arch(6 * u); g.fill(); g.strokeStyle = C.gold; g.lineWidth = 2.2 * u; arch(16 * u); g.stroke(); g.globalAlpha = .6; g.lineWidth = .8 * u; arch(22 * u); g.stroke(); g.globalAlpha = 1; g.fillStyle = bg; arch(23 * u); g.fill(); }
  if (d === 'mandala') { g.lineWidth = 1.1 * u; petals(W / 2, -W * .16, W * .45, 4, 'rgba(224,96,126,.45)', C.gold); petals(W / 2, -W * .16, W * .26, 3, 'rgba(31,110,115,.5)', null);
    for (const i of [0, 1, 5, 6]) { const x = W * (.1 + .8 * i / 6), dr = (.3 + .05 * (i % 2)) * W; g.setLineDash([2 * u, 2 * u]); g.strokeStyle = C.gold; g.globalAlpha = .7; g.lineWidth = .7 * u; g.beginPath(); g.moveTo(x, W * .12); g.lineTo(x, dr); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; g.fillStyle = C.gold; g.beginPath(); g.ellipse(x, dr + 5 * u, 3.5 * u, 5.5 * u, 0, 0, TAU); g.fill(); }
    g.globalAlpha = .45; g.lineWidth = .8 * u; petals(W / 2, H + W * .2, W * .3, 3, null, C.gold); g.globalAlpha = 1; }
  if (d === 'botanical') { g.strokeStyle = C.gold; g.globalAlpha = .5; g.lineWidth = .8 * u; g.strokeRect(12 * u, 12 * u, W - 24 * u, H - 24 * u); g.globalAlpha = 1;
    const ox = W * .74 - W * .31, oy = H * .55 - H * .46, bw = W * .62, bh = H * .92;
    for (const [x, y, sc] of [[.62, .28, 1], [.3, .55, .62], [.85, .72, .45]]) { const px = ox + bw * x, py = oy + bh * y;
      g.strokeStyle = C.gold; g.lineWidth = 1.3 * u; g.beginPath(); g.moveTo(ox + bw * x * .9, oy + bh); g.quadraticCurveTo(ox + bw * (x + .15), oy + bh * (y + 1) / 2, px, py + 40 * sc * u); g.stroke();
      const bwid = 120 * sc * u, bhgt = 90 * sc * u, base = [px, py + bhgt / 2];
      for (const [a, l] of [[-70, .85], [-35, .95], [0, 1], [35, .95], [70, .85]]) { const ang = (a - 90) * Math.PI / 180, len = bhgt * l, tx = base[0] + Math.cos(ang) * len * (bwid / bhgt) * .62, ty = base[1] + Math.sin(ang) * len, sd = ang + Math.PI / 2, w = bwid * .2, mx = (base[0] + tx) / 2, my = (base[1] + ty) / 2;
        g.beginPath(); g.moveTo(...base); g.quadraticCurveTo(mx + Math.cos(sd) * w, my + Math.sin(sd) * w, tx, ty); g.quadraticCurveTo(mx - Math.cos(sd) * w, my - Math.sin(sd) * w, ...base); g.fillStyle = 'rgba(142,30,69,.85)'; g.fill(); g.strokeStyle = C.gold; g.lineWidth = 1 * u; g.stroke(); } }
    g.fillStyle = C.gold; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(ox + bw * (.1 + .09 * i), oy + bh * (.15 + .08 * ((i * 5) % 9)), (1.5 + (i % 3)) * u, 0, TAU); g.fill(); } }
  // The words.
  const left = d === 'botanical', cx = left ? 32 * u : W / 2; g.textAlign = left ? 'left' : 'center'; g.textBaseline = 'alphabetic';
  let y = ({ lanterns: 92, heritage: 62, arch: 80, mandala: 116, botanical: 76 })[d] * u;
  const caps = (s, size, color, track) => { g.font = `500 ${size * u}px Georgia, serif`; g.fillStyle = color; if ('letterSpacing' in g) g.letterSpacing = `${track * u}px`; g.fillText(s, cx, y); if ('letterSpacing' in g) g.letterSpacing = '0px'; };
  // Every word is drawn: a text that would run long is set smaller (fitFont), never cut.
  const wrap = (s, font, color, gap, maxW) => { g.font = font; g.fillStyle = color; for (const l of cardLines(g, s, maxW)) { g.fillText(l, cx, y); y += gap; } };
  const fitFont = (s, make, from, min, maxW, lines) => { let z = from; g.font = make(z); while (z > min && cardLines(g, s, maxW).length > lines) { z -= 0.5; g.font = make(z); } return z; };
  if (st.to) { g.font = `italic ${13 * u}px Georgia, serif`; g.fillStyle = C.ink; g.fillText(t('card.dear', st.to), cx, y); y += 20 * u; }
  caps(t('card.happy').toUpperCase(), 11, C.ink, 4); y += 48 * u;
  const maxW = (left ? .56 : .8) * W, script = z => `${z}px "Great Vibes", cursive`;
  // The name on one line if it fits at a fair size, else on two.
  let size = fitFont(fname(f), script, (left ? 44 : 52) * u, 30 * u, maxW, 1);
  if (cardLines(g, fname(f), maxW).length > 1) size = fitFont(fname(f), script, (left ? 40 : 44) * u, 16 * u, maxW, 2);
  const nameLines = cardLines(g, fname(f), maxW);
  g.fillStyle = C.ink; nameLines.forEach((l, i) => { g.fillText(l, cx, y); if (i < nameLines.length - 1) y += size * 1.05; }); y += 26 * u;
  if (native) { const z = fitFont(native, z => `600 ${z}px Georgia, serif`, 17 * u, 10 * u, (left ? .58 : .86) * W, 2); wrap(native, `600 ${z}px Georgia, serif`, C.gold, z * 1.15, (left ? .58 : .86) * W); y += 2 * u; }
  // Divider: line, four petals, line.
  const dx = left ? cx + 60 * u : cx; g.strokeStyle = C.gold; g.lineWidth = 1 * u; g.beginPath(); g.moveTo(dx - 60 * u, y); g.lineTo(dx - 10 * u, y); g.moveTo(dx + 10 * u, y); g.lineTo(dx + 60 * u, y); g.stroke();
  for (let a = 0; a < TAU; a += Math.PI / 2) { g.beginPath(); g.moveTo(dx, y); g.lineTo(dx + Math.cos(a) * 8 * u, y + Math.sin(a) * 8 * u); g.stroke(); } y += 24 * u;
  if (line) {
    // As large as fits between here and the tagline at the foot, with the sender's line below it.
    const lw = (left ? .5 : .78) * W, foot = H - ((d === 'arch' || d === 'mandala' ? 66 : 58) + 16 + (st.from ? 26 : 0)) * u;
    let z = fitFont(line, z => `italic ${z}px Georgia, serif`, 12 * u, 7 * u, lw, 8);
    while (z > 6 * u && y + cardLines(g, line, lw).length * z * 1.33 > foot) { z -= 0.25 * u; g.font = `italic ${z}px Georgia, serif`; }
    wrap(line, `italic ${z}px Georgia, serif`, C.ink, z * 1.33, lw);
  }
  if (st.from) { y += 6 * u; g.font = `600 ${13 * u}px Georgia, serif`; g.fillStyle = C.gold; g.fillText(t('card.with', st.from), cx, y); y += 18 * u; }
  // The emblem, as large as the space above the tagline allows.
  const room = H - (d === 'arch' || d === 'mandala' ? 92 : 84) * u - y, es = Math.min(88 * u, room - 16 * u);
  if (!left && es > 40 * u) { const em = await tintedEmblem(f.card || 'lotus', C.accent, C.gold); g.fillStyle = C.dark ? 'rgba(226,184,92,.12)' : 'rgba(182,138,51,.1)'; g.beginPath(); g.arc(W / 2, y + 8 * u + es / 2, es * .57, 0, TAU); g.fill(); g.drawImage(em, W / 2 - es / 2, y + 8 * u, es, es); }
  y = H - (d === 'arch' || d === 'mandala' ? 66 : 58) * u;
  wrap(t('card.tag.' + cardTheme(f.card)).toUpperCase(), `500 ${9.5 * u}px Georgia, serif`, C.ink, 14 * u, (left ? .5 : .8) * W, 2);
  g.font = `${9 * u}px Georgia, serif`; g.fillStyle = C.ink; g.globalAlpha = .6; g.fillText(greg(date, { day: 'numeric', month: 'long', year: 'numeric' }), cx, y); g.globalAlpha = 1;
}
// The motion's light and accent: the palette's, or the design's gold and accent.
const motionColors = st => { if (st.design && st.design !== 'classic') { const C = DCOL[st.design === 'arch' ? 'arch' : st.design === 'mandala' ? 'mandala' : 'light']; return [C.gold, C.accent]; } return [PALETTES[st.p][4], PALETTES[st.p][3]]; };
function cardMaker(f, date) {
  const st = { p: cardPalette(f.card), to: '', from: '', msg: '', design: suggestedDesign(f.card), motion: 'still' };
  st.motion = st.design === 'classic' ? suggestedMotion(f.card) : 'still';
  const o = sheet(`<h2 class="serif">${esc(t('gr.card'))}</h2><div id="gcard" class="gcard"></div>
    <p class="label">${esc(t('card.design'))}</p><div class="chips" id="gde">${DESIGNS.map(m => `<button class="chip" data-de="${m}">${esc(t('card.d.' + m))}</button>`).join('')}</div>
    <p class="label">${esc(t('card.motion'))}</p><div class="chips" id="gmo">${MOTIONS.map(m => `<button class="chip" data-mo="${m}">${esc(t('card.m.' + m))}</button>`).join('')}</div>
    <div id="gpal"><p class="label">${esc(t('card.colour'))}</p><div style="display:flex;gap:8px;flex-wrap:wrap">${PALETTES.map((_, i) => `<button class="cardthumb" data-p="${i}" style="${cardBg(f.card, i)}"><i style="${cardArt(f.card, i)}"></i></button>`).join('')}</div></div>
    <label class="field"><span>${esc(t('card.to'))}</span><input id="gto" maxlength="40"></label>
    <label class="field"><span>${esc(t('card.from'))}</span><input id="gfrom" maxlength="40"></label>
    <label class="field"><span>${esc(t('card.message'))}</span><textarea id="gmsg" maxlength="300" rows="3"></textarea></label>
    <div class="chips">${['card.wish1', 'card.wish2', 'card.wish3'].map(k => `<button class="chip" data-w="${esc(t(k, fname(f)))}">${esc(t(k, fname(f)))}</button>`).join('')}</div>
    <button class="btn block" id="gshare" style="margin-top:12px">${esc(t('f.share'))}</button>`);
  const native = f.names[pack.language] !== fname(f) ? f.names[pack.language] : '';
  const line = () => st.msg || text(f.content?.greeting) || text(f.content?.summary) || '';
  const draw = () => {
    const P = PALETTES[st.p];
    o.querySelectorAll('[data-de]').forEach(b => b.classList.toggle('on', b.dataset.de === st.design));
    o.querySelector('#gpal').style.display = st.design === 'classic' ? '' : 'none';
    if (st.design !== 'classic') {
      // A designed card: drawn on a canvas, the same drawing as the shared image.
      o.querySelector('#gcard').innerHTML = `<div class="gcard-in"><canvas class="gdesign" width="640" height="800" style="position:absolute;inset:0;width:100%;height:100%"></canvas><canvas class="gmotion" width="640" height="800"></canvas><div class="gbrand"><img src="icon-192.png" alt="">Eka</div></div>`;
      drawDesign(o.querySelector('.gdesign').getContext('2d'), 640, 800, st.design, f, date, native, line(), st);
      o.querySelectorAll('[data-mo]').forEach(b => b.classList.toggle('on', b.dataset.mo === st.motion));
      return;
    }
    o.querySelector('#gcard').innerHTML = `<div class="gcard-in" style="${cardBg(f.card, st.p)};color:${P[2]}"><i style="${cardArt(f.card, st.p)}"></i>
      <div class="gtext">${st.to ? `<div class="gdear">${esc(t('card.dear', st.to))}</div>` : ''}${native ? `<div class="gnat" style="color:${P[3]}">${esc(native)}</div>` : ''}
      <div class="serif gname">${esc(fname(f))}</div><div class="gdate">${esc(greg(date, { day: 'numeric', month: 'long', year: 'numeric' }))}</div>
      ${line() ? `<div class="gline">${esc(line())}</div>` : ''}${st.from ? `<div class="gfrom" style="color:${P[3]}">${esc(t('card.with', st.from))}</div>` : ''}</div>
      <canvas class="gmotion" width="640" height="800"></canvas><div class="gbrand"><img src="icon-192.png" alt="">Eka</div></div>`;
    // Long words set smaller until the whole block stands inside the card.
    const gt = o.querySelector('.gtext'); for (let z = 1; z > 0.45 && gt.scrollHeight > gt.clientHeight + 1; z -= 0.04) gt.style.zoom = z;
    o.querySelectorAll('[data-mo]').forEach(b => b.classList.toggle('on', b.dataset.mo === st.motion));
  };
  // The preview's motion, drawn every frame while the card maker is open.
  const t0 = performance.now(), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = ts => {
    if (!o.isConnected) return;
    const cv = o.querySelector('.gmotion');
    if (cv) { const g = cv.getContext('2d'); g.clearRect(0, 0, 640, 800); if (st.motion !== 'still') drawMotion(g, st.motion, still ? 0 : (ts - t0) / 1000, 640, 800, ...motionColors(st)); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  o.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { st.p = +b.dataset.p; draw(); });
  o.querySelectorAll('[data-mo]').forEach(b => b.onclick = () => { st.motion = b.dataset.mo; draw(); });
  o.querySelectorAll('[data-de]').forEach(b => b.onclick = () => { st.design = b.dataset.de; draw(); });
  o.querySelector('#gto').oninput = e => { st.to = e.target.value; draw(); };
  o.querySelector('#gfrom').oninput = e => { st.from = e.target.value; draw(); };
  o.querySelector('#gmsg').oninput = e => { st.msg = e.target.value; draw(); };
  o.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { st.msg = b.dataset.w; o.querySelector('#gmsg').value = st.msg; draw(); });
  o.querySelector('#gshare').onclick = async () => {
    const btn = o.querySelector('#gshare'), label = btn.textContent;
    let blob = await cardImage(f, date, st, native, line()), type = 'image/png', ext = 'png';
    // A moving card goes out as a looping GIF.
    if (st.motion !== 'still') {
      btn.disabled = true; btn.textContent = t('card.making');
      const gif = await cardGif(blob, st).catch(() => null);
      btn.disabled = false; btn.textContent = label;
      if (gif) { blob = gif; type = 'image/gif'; ext = 'gif'; }
    }
    const file = new File([blob], `${f.id}.${ext}`, { type });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch {} }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  };
  draw();
}
// A moving card as a looping GIF, as on iOS (CardGIF): one four-second loop at 15 frames a second.
async function cardGif(png, st) {
  const { GIFEncoder, quantize, applyPalette } = await import('https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js');
  const W = 480, H = 600, base = await createImageBitmap(png), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true }), P = PALETTES[st.p], gif = GIFEncoder();
  for (let i = 0; i < 60; i++) {
    g.drawImage(base, 0, 0, W, H); drawMotion(g, st.motion, i / 15, W, H, ...motionColors(st));
    const { data } = g.getImageData(0, 0, W, H), palette = quantize(data, 256), index = applyPalette(data, palette);
    gif.writeFrame(index, W, H, { palette, delay: 67, repeat: 0 });
    if (i % 6 === 0) await new Promise(r => setTimeout(r));
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}
// The card as a 1080 x 1350 image: gradient, tinted art, then the words.
async function cardImage(f, date, st, native, line) {
  if (st.design && st.design !== 'classic') {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const g = c.getContext('2d');
    await drawDesign(g, 1080, 1350, st.design, f, date, native, line, st);
    const logo = new Image(); logo.src = 'icon-192.png'; await logo.decode().catch(() => {});
    // The mark in the bottom corner, inside the border.
    // A quiet signature in the bottom corner: the icon and "Eka".
    const C = DCOL[st.design === 'arch' ? 'arch' : st.design === 'mandala' ? 'mandala' : 'light'];
    g.globalAlpha = .55; if (logo.complete) g.drawImage(logo, 1080 - 86 - 74, 1350 - 76 - 24, 26, 26);
    g.font = '600 24px Georgia, serif'; g.fillStyle = C.ink; g.textAlign = 'left'; g.fillText('Eka', 1080 - 86 - 42, 1350 - 80); g.globalAlpha = 1;
    return new Promise(r => c.toBlob(r, 'image/png'));
  }
  const P = PALETTES[st.p], W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, P[0]); grad.addColorStop(1, P[1]);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const img = new Image(); img.src = `cards/${f.card || 'lotus'}.svg`; await img.decode();
  const art = document.createElement('canvas'); art.width = W; art.height = H; const a = art.getContext('2d');
  a.drawImage(img, 0, 0, W, H); a.globalCompositeOperation = 'source-in'; a.fillStyle = P[4]; a.fillRect(0, 0, W, H);
  g.globalAlpha = .85; g.drawImage(art, 0, 0); g.globalAlpha = 1; g.textAlign = 'center';
  let y = H * .36;
  const put = (s, font, color, gap) => { g.font = font; g.fillStyle = color; for (const l of cardLines(g, s, W - 220)) { g.fillText(l, W / 2, y); y += gap; } };
  // A long message is set smaller until it fits in seven lines; every word stays.
  const fit = (s, make, from, min, lines) => { let z = from; g.font = make(z); while (z > min && cardLines(g, s, W - 220).length > lines) { z -= 1; g.font = make(z); } return z; };
  if (st.to) put(t('card.dear', st.to), 'italic 48px Georgia, serif', P[2], 70);
  if (native) { const z = fit(native, z => `bold ${z}px sans-serif`, 80, 40, 2); put(native, `bold ${z}px sans-serif`, P[3], z * 1.25); }
  { const z = fit(fname(f), z => `bold ${z}px Georgia, serif`, 76, 40, 2); put(fname(f), `bold ${z}px Georgia, serif`, P[2], z * 0.95); }
  put(greg(date, { day: 'numeric', month: 'long', year: 'numeric' }), '500 38px sans-serif', P[2], 80);
  if (line) { const z = fit(line, z => `italic ${z}px Georgia, serif`, 40, 22, 7); put(line, `italic ${z}px Georgia, serif`, P[2], z * 1.35); }
  if (st.from) { y += 16; put(t('card.with', st.from), '600 44px Georgia, serif', P[3], 60); }
  // A small Kaal mark at the foot, for the brand.
  const logo = new Image(); logo.src = 'icon-192.png'; await logo.decode().catch(() => {});
  // A quiet signature in the bottom corner: the icon and "Eka".
  g.globalAlpha = .6; if (logo.complete) g.drawImage(logo, W - 40 - 74, H - 34 - 24, 26, 26);
  g.font = '600 24px Georgia, serif'; g.fillStyle = P[2]; g.textAlign = 'left'; g.fillText('Eka', W - 40 - 42, H - 38); g.globalAlpha = 1;
  return new Promise(r => c.toBlob(r, 'image/png'));
}

// ---------------------------------------------------------------- guide
// As on iOS (InfoViews.GuideView): every feature, where it is and how to use it.
function viewGuide() {
  const rows = [['hm.home', 'gd.home'], ['p.panchang', 'gd.panchang'], ['tab.calendar', 'gd.calendar'], ['tab.festivals', 'gd.festivals'],
    ['tab.muhurtham', 'gd.muhurtham'], ['mt.label', 'gd.match'], ['jk.title', 'gd.chart'], ['bs.title', 'gd.birthstar'], ['pp.title', 'gd.people'],
    ['v.title', 'gd.vrats'], ['sk.title', 'gd.sky'], ['tm.title', 'gd.temples'], ['py.title', 'gd.prayers'], ['ot.title', 'gd.oldtime'], ['s.notifications', 'gd.alertsWeb'], ['tab.settings', 'gd.settingsWeb']];
  // The web has no reminders, widgets or purchases: its guide says so rather than pointing at Settings.
  $('#main').innerHTML = `<h2 class="serif" style="margin:0">${esc(t('gd.title'))}</h2><p class="muted">${esc(t('gd.intro'))}</p>
    ${rows.map(([n, d]) => `<div class="card"><b style="color:var(--accent)">${esc(t(n))}</b><p style="margin:6px 0 0">${esc(t(d))}</p></div>`).join('')}`;
}

// ---------------------------------------------------------------- matching
// As on iOS (MatchViews): the tradition's matching under its own name - the ten
// poruthams in the South, Ashtakoota Guna Milan elsewhere - laid out as the
// Porutham app lays out a result. Any tradition can be chosen without changing
// the app's own; Telugu and Kannada homes use either system. Free here.
const matchingAvailable = () => true;
const PORUTHAM = ['malayalam', 'tamil', 'telugu', 'kannada', 'sri-lankan-tamil', 'malaysian-tamil', 'south-african-tamil'], BOTH = ['telugu', 'kannada'];
const matchTitle = (c = S.culture) => t('mt.n.' + c);
const STAR_KEYS = ['ashwini', 'bharani', 'krittika', 'rohini', 'mrigashira', 'ardra', 'punarvasu', 'pushya', 'ashlesha', 'magha', 'purva_phalguni',
  'uttara_phalguni', 'hasta', 'chitra', 'swati', 'vishakha', 'anuradha', 'jyeshtha', 'mula', 'purva_ashadha', 'uttara_ashadha', 'shravana',
  'dhanishta', 'shatabhisha', 'purva_bhadrapada', 'uttara_bhadrapada', 'revati'];
const MT = { bride: '', groom: '', culture: '', eight: false, lang: '' };
const READ_LANGS = [['en', 'English'], ['ml', 'മലയാളം'], ['ta', 'தமிழ்'], ['hi', 'हिन्दी'], ['te', 'తెలుగు'], ['kn', 'ಕನ್ನಡ'],
  ['gu', 'ગુજરાતી'], ['mr', 'मराठी'], ['bn', 'বাংলা'], ['or', 'ଓଡ଼ିଆ'], ['ne', 'नेपाली']];
async function viewMatch() {
  const trad = MT.culture || S.culture, both = BOTH.includes(trad), ten = PORUTHAM.includes(trad) && !(both && MT.eight), L = MT.lang || lang();
  const list = S.people.filter(p => p.kind !== 'remembrance' && p.anchor && p.place);
  // Each slot holds only whom the user chose.
  const bride = list.find(p => p.id === MT.bride), groom = list.find(p => p.id === MT.groom);
  const opt = (l, sel) => `<option value="">${esc(t('m.choose'))}</option>` + l.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(personLabel(p))}</option>`).join('') + `<option value="+">＋ ${esc(t('m.addProfile'))}</option>`;
  $('#main').innerHTML = `<label class="field"><span>${esc(t('mt.tradition'))}</span><select id="xc">${CULTURES.map(c => `<option value="${c.id}" ${c.id === trad ? 'selected' : ''}>${esc(matchTitle(c.id))} · ${esc(S.native ? c.native : c.en)}</option>`).join('')}</select></label>
    <h2 class="serif" style="margin:0">${esc(matchTitle(trad))}</h2><p class="muted" style="margin-top:2px">${esc(t(ten ? 'mt.ten' : 'mt.eight'))}</p>
    <p class="small" style="background:var(--soft);padding:12px;border-radius:12px">${esc(tIn(L, 'mt.d.' + trad))}</p>
    <label class="field"><span>${esc(t('mt.readIn'))}</span><select id="xl">${READ_LANGS.map(([c, n]) => `<option value="${c}" ${c === L ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    ${both ? `<div class="seg" style="margin-bottom:10px"><button data-sys="0" class="${!MT.eight ? 'on' : ''}">${esc(t('mt.sysTen'))}</button><button data-sys="1" class="${MT.eight ? 'on' : ''}">${esc(t('mt.sysEight'))}</button></div>` : ''}
    <div class="card"><p class="label">${esc(t('m.couple'))}</p><p class="small muted">${esc(t('mt.choose'))}</p>
      <label class="field"><span>${esc(t('m.bride'))}</span><select id="xb">${opt(list.filter(p => p.sex !== 'male'), MT.bride)}</select><div class="small muted">${esc(natalLine(bride?.anchor))}</div></label>
      <label class="field"><span>${esc(t('m.groom'))}</span><select id="xg">${opt(list.filter(p => p.sex !== 'female'), MT.groom)}</select><div class="small muted">${esc(natalLine(groom?.anchor))}</div></label></div>
    <div id="xres"></div>`;
  const pick = (sel, key, sex) => sel.onchange = () => {
    if (sel.value === '+') personEditor(null, sex, rec => { MT[key] = rec.id; viewMatch(); });
    else { MT[key] = sel.value; viewMatch(); }
  };
  pick($('#xb'), 'bride', 'female'); pick($('#xg'), 'groom', 'male');
  $('#xc').onchange = () => { MT.culture = $('#xc').value; MT.eight = false; viewMatch(); };
  $('#xl').onchange = () => { MT.lang = $('#xl').value; viewMatch(); };
  $('#main').querySelectorAll('[data-sys]').forEach(b => b.onclick = () => { MT.eight = b.dataset.sys === '1'; viewMatch(); });
  if (!bride || !groom) return;
  $('#xres').innerHTML = '<div class="loading"><div class="ring"><i></i></div></div>';
  let r;
  // Dasa Sandhi is a South Indian check: with the eight kootas only where those homes use them.
  try { r = ten ? await poruthamReport(bride, groom, L) : await gunaMilanReport(bride, groom, L, PORUTHAM.includes(trad)); }
  catch (e) { $('#xres').innerHTML = `<div class="card">${esc(t('c.error', e.message))}</div>`; return; }
  if (tab !== 'match' || (MT.culture || S.culture) !== trad || (MT.lang || lang()) !== L) return;
  $('#xres').innerHTML = matchReportHtml(r);
}
const birthSide = p => ({ date: p.date, minutes: p.minutes ?? undefined, location: p.place });
async function poruthamReport(bride, groom, L) {
  const m = await engine({ op: 'poruthamMatch', bride: birthSide(bride), groom: birthSide(groom) });
  // Stars and signs as this tradition names them when it names them in L; otherwise the reading's own.
  const nm = (table, k) => { const e = pack?.names?.[table]?.[k]; return e ? (e[L] ?? e.en) : k; };
  const has = L === 'en' || pack?.names?.nakshatras?.ashwini?.[L];
  return JSON.parse(window.PoruthamRender(L, m, { bride: bride.name, groom: groom.name, now: Date.now() / 1000,
    ...(has ? { stars: STAR_KEYS.map(k => nm('nakshatras', k)), signs: SIGNS.map(k => nm('rashis', k)) } : {}) }));
}
async function gunaMilanReport(bride, groom, L, dasa) {
  const c = await engine({ op: 'gunaMilan', bride: birthSide(bride), groom: birthSide(groom) });
  const m = c.milan;
  // Text in L; star, sign and graha names from the reading text in L.
  const t = (k, ...a) => tIn(L, k, ...a);
  const N = (window.PoruthamText[L] || window.PoruthamText.en).names;
  const name = (table, k) => table === 'rashis' ? (N.signs[SIGNS.indexOf(k)] ?? k) : (N.lords[k] ?? k);
  const natalLine = a => a ? [N.stars[STAR_KEYS.indexOf(a.nakshatra)] + (a.pada ? ' · ' + t('bs.pada', a.pada) : ''), a.moonSign && name('rashis', a.moonSign)].filter(Boolean).join(' · ') : '';
  const pts = x => Number.isInteger(x) ? String(x) : x % 1 === 0.5 ? (Math.floor(x) || '') + '½' : x.toFixed(1);
  const value = (k, v) => k.key === 'bhakoot' ? name('rashis', v) : k.key === 'graha-maitri' ? name('grahas', v) : t('gmv.' + v);
  const rows = m.kootas.map(k => {
    const reason = k.key === 'tara' ? t('mt.reasonTara', k.bride, k.groom, pts(k.points))
      : t('mt.reason', t('gm.' + k.key), value(k, k.bride), value(k, k.groom), pts(k.points), pts(k.max));
    const sections = [[t('mt.signifies'), t(`gm.${k.key}.meaning`)], [t('mt.reasoning'), reason], [t('mt.rule'), t(`gm.${k.key}.rule`)]];
    const zero = (k.key === 'nadi' && m.nadiZero) || (k.key === 'bhakoot' && m.bhakootZero);
    if (zero) {
      const lines = m.cancellations.filter(x => x.of === k.key).map(x => `· ${t('gm.c.' + x.condition)}: ${t(x.holds ? 'gm.holds' : 'gm.notHold')}`);
      if (lines.length) sections.push([t('gm.cancel'), lines.join('\n')]);
    }
    return { key: k.key, name: t('gm.' + k.key), about: t(`gm.${k.key}.about`), matching: k.points > 0, verdict: `${pts(k.points)} / ${pts(k.max)}`,
      tags: zero ? [t('pr.weighed')] : [], notes: zero ? [t(k.key === 'nadi' ? 'gm.nadiRule' : 'gm.bhakootRule')] : [], sections };
  });
  const mars = [[bride, c.brideKuja], [groom, c.groomKuja]].map(([p, kuja]) => ({ name: p.name, about: natalLine(p.anchor), matching: null,
    verdict: `${kuja.filter(k => k.listed).length} / ${kuja.length}`, tags: [],
    sections: [[t('mt.mangalTitle'), kuja.map(k => `${t('jk.kujaRow', k.house, k.from === 'lagna' ? t('jk.lagnaWord') : name('grahas', k.from))} · ${t(k.listed ? 'mt.marsListed' : 'jk.kujaNot')}`).join('\n')]] }));
  const yes = rows.filter(x => x.matching), no = rows.filter(x => !x.matching);
  const r = { score: m.total, outOf: t('mt.outOf36'), band: t('gm.band.' + m.band), reading: null,
    bride: { label: t('m.bride'), star: natalLine(bride.anchor), sign: '' }, groom: { label: t('m.groom'), star: natalLine(groom.anchor), sign: '' },
    matching: t('mt.gave', yes.length), matchingNames: yes.map(x => x.name), notMatching: t('mt.gaveNone', no.length), notMatchingNames: no.map(x => x.name),
    notes: [m.nadiZero && t('gm.nadiRule'), m.bhakootZero && t('gm.bhakootRule')].filter(Boolean), rows, deeperTitle: t('mt.mangalTitle'), deeperNote: t('mt.marsNote'), deeper: mars,
    honestTitle: t('mt.honest'), honest: t('gm.note') };
  // Dasa Sandhi, read as the ten-porutham reading reads it.
  if (dasa) { const p = await poruthamReport(bride, groom, L); r.deeper.push(p.deeper[p.deeper.length - 1]); r.deeperTitle = p.deeperTitle; }
  return r;
}
function matchReportHtml(r) {
  const br = s => esc(s).replace(/\n/g, '<br>');
  const score = Number.isInteger(r.score) ? r.score : r.score.toFixed(1);
  const side = s => `<div class="row"><span class="muted small"><b>${esc(s.label)}</b></span><span class="v">${esc([s.star, s.sign].filter(Boolean).join(' · '))}</span></div>`;
  const row = x => `<details class="factor"><summary><span class="${x.matching === true ? 'tick' : 'cross'}">${x.matching === true ? '✓' : x.matching === false ? '✗' : '○'}</span>
      <span class="grow"><b>${esc(x.name)}</b>${x.about ? `<span class="small muted" style="display:block">${esc(x.about)}</span>` : ''}${(x.tags || []).map(g => `<span class="pill">${esc(g)}</span>`).join('')}</span>
      <span class="small" style="font-weight:700;${x.matching === true ? 'color:var(--accent)' : ''}">${esc(x.verdict)}</span></summary>
    ${(x.notes || []).map(n => `<p class="small" style="color:var(--accent)">${esc(n)}</p>`).join('')}
    ${x.sections.map(([h, b]) => `${h ? `<p class="label" style="margin:10px 0 2px">${esc(h)}</p>` : ''}${b ? `<p style="margin:0">${br(b)}</p>` : ''}`).join('')}</details>`;
  return `<div class="card"><div><span class="serif" style="font-size:48px;font-weight:700;color:var(--accent)">${esc(score)}</span> <b class="muted">${esc(r.outOf)}</b></div>
      <h3 style="margin:4px 0">${esc(r.band)}</h3>${r.reading ? `<p class="muted">${esc(r.reading)}</p>` : ''}${side(r.bride)}${side(r.groom)}</div>
    <div class="card"><div style="color:var(--accent);font-weight:700">${esc(r.matching)}</div><div class="small muted">${esc(r.matchingNames.join(' · '))}</div>
      ${r.notMatchingNames.length ? `<div style="font-weight:700;margin-top:8px">${esc(r.notMatching)}</div><div class="small muted">${esc(r.notMatchingNames.join(' · '))}</div>` : ''}
      ${r.notes.map(n => `<p class="small" style="background:var(--sunken);padding:10px;border-radius:10px">${esc(n)}</p>`).join('')}</div>
    ${r.rows.map(row).join('')}
    ${r.deeper.length ? `<p class="label" style="margin-top:16px">${esc(r.deeperTitle)}</p>${r.deeperNote ? `<p class="small muted">${esc(r.deeperNote)}</p>` : ''}${r.deeper.map(row).join('')}` : ''}
    <div class="card" style="margin-top:12px"><p class="label">${esc(r.honestTitle)}</p><p class="small muted">${esc(r.honest)}</p></div>`;
}

// ---------------------------------------------------------------- porutham
async function poruthamSheet(bride, groom) {
  const ten = await engine({ op: 'porutham', bride: { nakshatra: bride.anchor.nakshatra, moonSign: bride.anchor.moonSign }, groom: { nakshatra: groom.anchor.nakshatra, moonSign: groom.anchor.moonSign } });
  sheet(`<div style="clear:both"></div><h2 class="serif">${esc(t('py.title'))}</h2>
    <div><b>${esc(t('pdf.couple', bride.name, groom.name))}</b></div>
    <div class="small muted">${esc(t('m.bride'))}: ${esc(natalLine(bride.anchor))}</div><div class="small muted">${esc(t('m.groom'))}: ${esc(natalLine(groom.anchor))}</div>
    <h3 style="color:var(--accent)">${esc(t('pr.summary', ten.filter(p => p.matching === true).length))}</h3>
    <div class="card">${ten.map(p => `<div class="list-row"><span class="${p.matching ? 'tick' : 'cross'}">${p.matching === true ? '✓' : p.matching === false ? '✗' : '–'}</span>
      <div class="grow"><b>${esc(t('pr.' + p.key))}</b> ${p.critical ? `<span class="pill">${esc(t('pr.weighed'))}</span>` : ''}
      <div class="small muted">${esc(t('pr.' + p.key + '.about'))}</div>
      <div class="small"><b>${esc(t(p.matching === true ? 'pr.agrees' : p.matching === false ? 'pr.differs' : 'pr.undecided'))}</b> · <span class="muted">${esc(p.detail)}</span></div></div></div>`).join('')}</div>
    <p class="small muted">${esc(t('pr.note'))}</p>
    <button class="btn soft block noprint" onclick="window.print()">${SHARE_ICON} ${esc(t('pdf.share'))}</button>`);
}

// ---------------------------------------------------------------- settings
function viewSettings() {
  $('#main').innerHTML = `<div class="card"><p class="label">${esc(t('s.tradition'))}</p>
      <div class="chips">${CULTURES.map(c => `<button class="chip ${S.culture === c.id ? 'on' : ''}" data-c="${c.id}">${c.native}<br><small>${c.en}</small></button>`).join('')}</div>
      <label class="field"><span>${esc(t('s.language'))}</span><div class="seg"><button data-l="0" class="${!S.native ? 'on' : ''}">English</button><button data-l="1" class="${S.native ? 'on' : ''}">${esc(langName(pack.language))}</button></div></label></div>
    <div class="card"><p class="label">${esc(t('s.home'))}</p><div><b>${esc(S.home.name)}</b> <span class="small muted">${esc([S.home.region, S.home.country].filter(Boolean).join(', '))}</span></div><div id="hp" style="margin-top:8px"></div></div>
    <div class="card"><p class="label">${esc(t('s.appearance'))}</p>
      <div class="seg">${['system', 'light', 'dark'].map(m => `<button data-th="${m}" class="${S.theme === m ? 'on' : ''}">${esc(t('s.' + m))}</button>`).join('')}</div>
      <p class="small muted" style="margin-top:10px">${esc(t('th.light'))}</p><div class="chips">${LIGHT.map(id => `<button class="chip ${S.light === id ? 'on' : ''}" data-lt="${id}">${esc(t('th.' + id))}</button>`).join('')}</div>
      <p class="small muted" style="margin-top:10px">${esc(t('th.dark'))}</p><div class="chips">${DARK.map(id => `<button class="chip ${S.dark === id ? 'on' : ''}" data-dk="${id}">${esc(t('th.' + id))}</button>`).join('')}</div></div>
    <div class="card"><label class="list-row"><input type="checkbox" id="vaish" ${S.vaishnava ? 'checked' : ''}><span class="grow"><b>${esc(t('s.vaishnava'))}</b><div class="small muted">${esc(t('s.vaishnavaNote'))}</div></span></label></div>
    <div class="card"><label class="list-row"><input type="checkbox" id="pdfmark" ${S.pdfWatermark !== false ? 'checked' : ''}><span class="grow"><b>${esc(t('pdf.section'))}</b><div class="small muted">${esc(t('pdf.watermarkOn'))}</div></span></label></div>
    <div class="card"><p class="label">${esc(t('s.clock'))}</p><div class="seg">${[[0, 's.clockSystem'], [12, 's.clock12'], [24, 's.clock24']].map(([v, k]) => `<button data-ck="${v}" class="${(S.clock || 0) === v ? 'on' : ''}">${esc(t(k))}</button>`).join('')}</div></div>
    <div class="card"><p class="label">${esc(t('ts.title'))}</p><div class="seg">${TEXT_SIZES.map((z, i) => `<button data-tz="${i}" class="${S.textSize === i ? 'on' : ''}" style="font-size:${Math.round(12 * z + (i - 1) * 2)}px">A</button>`).join('')}</div>
      <p class="small muted" style="margin-top:8px">${esc(t('ts.sample'))}</p></div>
    <div class="card about"><p class="label">${esc(t('s.about'))}</p><img src="icon-192.png" alt="" class="aboutlogo"><h3 class="serif" style="margin:6px 0 2px">Eka Panchang</h3>
      <p class="serif" style="color:var(--accent);font-size:18px;margin:0 0 10px">${esc(t('ab.motto'))}</p>
      <p class="small muted" style="margin:-6px 0 10px">Eka Panchang · web ${esc(V)}</p>
      ${[['ab.nameT', 'ab.name'], ['ab.diasporaT', 'ab.diaspora'], ['ab.privacyT', 'ab.privacy'], ['ab.respectT', 'ab.respect']].map(([h, b]) => `<p style="margin:10px 0 2px"><b>${esc(t(h))}</b></p><p class="small" style="margin:0">${esc(t(b))}</p>`).join('')}
      <p class="small muted" style="margin-top:12px">${esc(t('web.what'))}</p>
      <p class="small muted">${esc(t('s.attribution'))}</p><p class="small"><a href="https://funtopiaapp.github.io/kaal-privacy/">${esc(t('mn.support'))}</a> · <a href="https://funtopiaapp.github.io/kaal-privacy/privacy.html">${esc(t('mn.privacy'))}</a></p>
      <p class="small muted">Web edition for testing · all features unlocked</p></div>`;
  $('#main').querySelectorAll('[data-c]').forEach(b => b.onclick = async () => { S.culture = b.dataset.c; save(); await loadPack(); await resetCalendars(); render(); });
  $('#main').querySelectorAll('[data-l]').forEach(b => b.onclick = () => { S.native = b.dataset.l === '1'; save(); render(); });
  $('#main').querySelectorAll('[data-th]').forEach(b => b.onclick = () => { S.theme = b.dataset.th; save(); render(); });
  $('#main').querySelector('#pdfmark').onchange = e => { S.pdfWatermark = e.target.checked; save(); };
  $('#main').querySelector('#vaish').onchange = async e => { S.vaishnava = e.target.checked; save(); await loadPack(); await resetCalendars(); render(); };
  $('#main').querySelectorAll('[data-ck]').forEach(b => b.onclick = () => { S.clock = +b.dataset.ck; save(); render(); });
  $('#main').querySelectorAll('[data-tz]').forEach(b => b.onclick = () => { S.textSize = +b.dataset.tz; save(); render(); });
  $('#main').querySelectorAll('[data-lt]').forEach(b => b.onclick = () => { S.light = b.dataset.lt; save(); render(); });
  $('#main').querySelectorAll('[data-dk]').forEach(b => b.onclick = () => { S.dark = b.dataset.dk; save(); render(); });
  placePicker($('#hp'), async p => { S.home = p; save(); await resetCalendars(); tab = 'today'; render(); });
}

// ---------------------------------------------------------------- boot
async function loadPack() {
  if (!S.culture) return;
  packJson = await (await fetch(`packs/${S.culture}.json?v=${V}`)).text();
  // Every Ekadashi by the Vaishnava rule when chosen, as on iOS (Pack.vaishnava).
  if (S.vaishnava) packJson = packJson.replace(/"kala":\s*"ekadashi"/g, '"kala": "ekadashi-vaishnava"');
  pack = JSON.parse(packJson);
}
(async () => {
  STR = await (await fetch('strings.json?v=' + V)).json();
  await loadPack();
  render();
})();
