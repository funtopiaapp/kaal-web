// Kaal for the web: the iOS app's screens over the same engine (kaal_wasm),
// the same content packs and the same interface text. Everything is
// unlocked here; settings and profiles stay in this browser.
import { engine, onRestart } from './engine.js?v=202610292329';
import { showGames, GM, gameKey, VIGIL } from './games.js?v=202610292329';
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
  ['people', 'mn.profiles'], ['birthstar', 'bs.title'], ['vrats', 'v.title'], ['jathakam', 'jk.title'], ['match', 'mt.label'], ['greetings', 'gr.title'], ['guide', 'gd.title'], ['sky', 'sk.title'], ['temples', 'tm.title'], ['prayers', 'py.title'], ['games', 'gm.menu'], ['oldtime', 'ot.title'], ['settings', 'tab.settings']];

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
function dtf(opts, L = lang()) {
  const f = new Intl.DateTimeFormat(L === 'en' ? 'en-IN' : `${L}-IN`, opts), N = DATE_NAMES[L];
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
  handles.clear(); placeFests.clear();
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
// ---------------------------------------------------------------- at home and away
// The away place (where the user lives now), unless it is home itself.
const awayPlace = () => S.away && S.away.id !== S.home?.id ? S.away : null;
// Another place's festivals for a year, read once per tradition, place and year.
const placeFests = new Map();
function festsAt(y, place) {
  const key = `${S.culture}|${place.id}|${place.latitude}|${y}`;
  if (!placeFests.has(key)) {
    const p = cal(y, place).then(handle => engine({ op: 'festivals', handle }));
    p.catch(() => { if (placeFests.get(key) === p) placeFests.delete(key); });
    placeFests.set(key, p);
  }
  return placeFests.get(key);
}
// The festival dates there by id, for home dates from..to (three days more each side, so the edge of a year is not missed).
async function awayIndex(from, to, place) {
  const idx = new Map();
  for (let y = +addDays(from, -3).slice(0, 4); y <= +addDays(to, 3).slice(0, 4); y++)
    for (const o of await festsAt(y, place)) { if (!idx.has(o.id)) idx.set(o.id, []); idx.get(o.id).push(o.date); }
  return idx;
}
// The same festival there: of its dates, the one nearest the home date, within three days either way.
function nearestDate(dates, date) {
  let best = null, bn = 4;
  for (const d of dates || []) { const n = Math.abs(daysBetween(date, d)); if (n < bn) { bn = n; best = d; } }
  return best;
}
// How the away date stands to home's: Same day, A day earlier, 3 days later.
function relation(home, away) {
  const n = daysBetween(home, away);
  return t(n === 0 ? 'ha.same' : n === -1 ? 'ha.earlier' : n === 1 ? 'ha.later' : n < 0 ? 'ha.earlierN' : 'ha.laterN', Math.abs(n));
}
// A time on the clock of a given place.
const clockIn = (u, tz) => dtf({ hour: 'numeric', minute: '2-digit', ...hourOpts(), timeZone: tz }).format(new Date(u * 1000));
const AWAY_PIN = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
// The away place chosen from the same search as home's.
function pickAway(done) {
  sheet(`<h2 class="serif">${esc(t('s.away'))}</h2><div id="awp"></div>`, o => placePicker(o.querySelector('#awp'), p => { S.away = p; save(); o.remove(); done?.(); }));
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
  // What the pill is, small above what is chosen.
  $('#badge').innerHTML = c ? `<span class="bdgcap">${esc(t('s.tradition'))}</span><span>☀ ${esc(S.native ? c.native : c.en)} ▾</span>` : '';
  // The tradition, switched where you are: a sheet of all fifteen, not a trip to Settings.
  $('#badge').onclick = () => {
    const o = sheet(`<h2 class="serif">${esc(t('s.tradition'))}</h2><p class="small muted">${esc(t('s.traditionWhat'))}</p><div class="chips">${CULTURES.map(x => `<button class="chip ${S.culture === x.id ? 'on' : ''}" data-tc="${x.id}">${x.native}<br><small>${x.en}</small></button>`).join('')}</div>`);
    o.querySelectorAll('[data-tc]').forEach(b => b.onclick = async () => { o.remove(); if (b.dataset.tc === S.culture) return; S.culture = b.dataset.tc; save(); await loadPack(); await resetCalendars(); render(); });
  };
  infoButton();
  // English or the tradition's language, beside the tradition picker.
  if (pack) { $('#langbadge').innerHTML = `<span class="bdgcap">${esc(t('s.language'))}</span><span>🗣 ${esc(S.native ? langName(pack.language) : 'English')} ▾</span>`; $('#langbadge').onclick = () => { S.native = !S.native; save(); render(); }; }
  const house = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:4px"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>';
  // The daily five one tap away; everything else under More.
  const DAILY = ['home', 'today', 'calendar', 'festivals', 'muhurtham'], rest = TABS.filter(([id]) => !DAILY.includes(id) && (id !== 'match' || matchingAvailable()));
  $('#tabs').innerHTML = TABS.filter(([id]) => DAILY.includes(id)).map(([id, k]) => `<button data-tab="${id}" class="${id === tab ? 'on' : ''}">${id === 'home' ? house : ''}${esc(t(k))}</button>`).join('')
    + `<button data-more class="${DAILY.includes(tab) ? '' : 'on'}">${DAILY.includes(tab) ? '' : esc(t(TABS.find(([id]) => id === tab)?.[1] || 'mn.more')) + ' · '}${esc(t('mn.more'))} ▾</button>`;
  $('#tabs').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; if (tab === 'today') { dayDate = null; dayPlace = null; } render(); });
  $('#tabs').querySelector('[data-more]').onclick = () => {
    const o = sheet(`<h2 class="serif">${esc(t('mn.more'))}</h2><div class="morehub">${rest.map(([id, k]) => `<button class="tile" data-mt="${id}"><b>${esc(t(k))}</b></button>`).join('')}</div>`);
    o.querySelectorAll('[data-mt]').forEach(b => b.onclick = () => { o.remove(); tab = b.dataset.mt; if (tab === 'games') GM.screen = null; render(); scrollTo(0, 0); });
  };
  // The copyright with the web build's version (the stamp build-web.sh puts on app.js).
  const build = V;
  $('#foot').innerHTML = `<div>© ${new Date().getFullYear()} Funtopia App Company · web ${build}</div><div>${esc(t('s.attribution'))}</div>`;
}
// The Eka Panchang mark blooming while something loads, as on iOS (LogoBloom).
const BLOOM = `<svg class="bloom" viewBox="-170 -170 340 340" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#B8862E"/><stop offset=".5" stop-color="#E9C266"/><stop offset="1" stop-color="#F6D47C"/></linearGradient></defs><circle class="rg" r="156" fill="none" stroke="#E9C266" stroke-width="2" pathLength="1"/><circle r="148" fill="none" stroke="#E9C266" stroke-opacity=".7" stroke-width="1" stroke-dasharray="1.5 4"/><path class="dm" transform="rotate(22.5) translate(0,-150)" d="M0 -6 L4 0 L0 6 L-4 0Z" fill="#E9C266"/><path class="dm" transform="rotate(67.5) translate(0,-150)" d="M0 -6 L4 0 L0 6 L-4 0Z" fill="#E9C266"/><path class="dm" transform="rotate(112.5) translate(0,-150)" d="M0 -6 L4 0 L0 6 L-4 0Z" fill="#E9C266"/><path class="dm" transform="rotate(157.5) translate(0,-150)" d="M0 -6 L4 0 L0 6 L-4 0Z" fill="#E9C266"/><path class="dm" transform="rotate(202.5) translate(0,-150)" d="M0 -6 L4 0 L0 6 L-4 0Z" fill="#E9C266"/><path class="dm" transform="rotate(247.5) translate(0,-150)" d="M0 -6 L4 0 L0 6 L-4 0Z" fill="#E9C266"/><path class="dm" transform="rotate(292.5) translate(0,-150)" d="M0 -6 L4 0 L0 6 L-4 0Z" fill="#E9C266"/><path class="dm" transform="rotate(337.5) translate(0,-150)" d="M0 -6 L4 0 L0 6 L-4 0Z" fill="#E9C266"/><g class="pt" style="--i:0" transform="rotate(0) translate(0,-50)"><path d="M0 0 C-44 -28 -30 -82 0 -104 C30 -82 44 -28 0 0Z" fill="url(#lg)"/><path d="M0 0 L0 -100 M0 -26 Q-6 -32 -14 -36 M0 -26 Q6 -32 14 -36 M0 -50 Q-7 -56 -15 -62 M0 -50 Q7 -56 15 -62 M0 -72 Q-5 -77 -10 -82 M0 -72 Q5 -77 10 -82" fill="none" stroke="#B8862E" stroke-width="1"/></g><g class="pt" style="--i:1" transform="rotate(60) translate(0,-50)"><path d="M0 0 C-44 -28 -30 -82 0 -104 C30 -82 44 -28 0 0Z" fill="url(#lg)"/><path d="M0 0 L0 -100 M0 -26 Q-6 -32 -14 -36 M0 -26 Q6 -32 14 -36 M0 -50 Q-7 -56 -15 -62 M0 -50 Q7 -56 15 -62 M0 -72 Q-5 -77 -10 -82 M0 -72 Q5 -77 10 -82" fill="none" stroke="#B8862E" stroke-width="1"/></g><g class="pt" style="--i:2" transform="rotate(120) translate(0,-50)"><path d="M0 0 C-44 -28 -30 -82 0 -104 C30 -82 44 -28 0 0Z" fill="url(#lg)"/><path d="M0 0 L0 -100 M0 -26 Q-6 -32 -14 -36 M0 -26 Q6 -32 14 -36 M0 -50 Q-7 -56 -15 -62 M0 -50 Q7 -56 15 -62 M0 -72 Q-5 -77 -10 -82 M0 -72 Q5 -77 10 -82" fill="none" stroke="#B8862E" stroke-width="1"/></g><g class="pt" style="--i:3" transform="rotate(180) translate(0,-50)"><path d="M0 0 C-44 -28 -30 -82 0 -104 C30 -82 44 -28 0 0Z" fill="url(#lg)"/><path d="M0 0 L0 -100 M0 -26 Q-6 -32 -14 -36 M0 -26 Q6 -32 14 -36 M0 -50 Q-7 -56 -15 -62 M0 -50 Q7 -56 15 -62 M0 -72 Q-5 -77 -10 -82 M0 -72 Q5 -77 10 -82" fill="none" stroke="#B8862E" stroke-width="1"/></g><g class="pt" style="--i:4" transform="rotate(240) translate(0,-50)"><path d="M0 0 C-44 -28 -30 -82 0 -104 C30 -82 44 -28 0 0Z" fill="url(#lg)"/><path d="M0 0 L0 -100 M0 -26 Q-6 -32 -14 -36 M0 -26 Q6 -32 14 -36 M0 -50 Q-7 -56 -15 -62 M0 -50 Q7 -56 15 -62 M0 -72 Q-5 -77 -10 -82 M0 -72 Q5 -77 10 -82" fill="none" stroke="#B8862E" stroke-width="1"/></g><g class="pt" style="--i:5" transform="rotate(300) translate(0,-50)"><path d="M0 0 C-44 -28 -30 -82 0 -104 C30 -82 44 -28 0 0Z" fill="url(#lg)"/><path d="M0 0 L0 -100 M0 -26 Q-6 -32 -14 -36 M0 -26 Q6 -32 14 -36 M0 -50 Q-7 -56 -15 -62 M0 -50 Q7 -56 15 -62 M0 -72 Q-5 -77 -10 -82 M0 -72 Q5 -77 10 -82" fill="none" stroke="#B8862E" stroke-width="1"/></g><circle r="56" fill="#004B45"/><g class="gl" fill="none" stroke="#E9C266" stroke-width="1.4"><circle r="25"/><path d="M-22 -12 H22 M-25 0 H25 M-22 12 H22"/><ellipse class="mer" rx="12" ry="25"/><ellipse class="mer m2" rx="6" ry="25"/></g></svg>`;
function loading() { $('#main').innerHTML = `<div class="loading">${BLOOM}<div class="muted">${esc(t('r3.load1'))}</div><div class="small muted">${esc(t('r3.load2'))}</div></div>`; }
function sheet(html, onOpen) {
  const o = document.createElement('div'); o.className = 'overlay';
  o.innerHTML = `<div class="sheet"><button class="btn soft close noprint">${esc(t('c.close'))}</button>${html}</div>`;
  // A sheet still saving stays open until it is done.
  o.onclick = e => { if (e.target === o && !o.dataset.busy) o.remove(); };
  o.querySelector('.close').onclick = () => { if (!o.dataset.busy) o.remove(); };
  document.body.appendChild(o); onOpen?.(o); return o;
}

async function render() {
  clearTimeout(turnTimer); stopOldTime();
  applyTheme(); applyTextSize(); shell();
  if (!S.culture || !S.home) return onboarding();
  if (S.onboardProfile === 'pending') return onboardProfile();
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
    if (tab === 'games') return viewGames();
    if (tab === 'oldtime') return await viewOldTime();
    if (tab === 'sky') return await viewSky();
    if (tab === 'people') return await viewPeople();
    if (tab === 'settings') return viewSettings();
  } catch (e) { $('#main').innerHTML = `<div class="card">${esc(t('c.error', e.message))}</div>`; }
}

// ---------------------------------------------------------------- onboarding
// A first run: the tradition, the home place, then an offer to add a person. Only someone starting here sees that
// last step; a user who chose a tradition before it existed never does.
let onbFresh = false;
function onboarding() {
  if (!S.culture) onbFresh = true;
  $('#tabs').innerHTML = '';
  $('#main').innerHTML = `<div class="card"><h1 class="serif" style="margin:0">Eka Panchang</h1><p class="muted">${esc(t('o.welcome'))}</p>
    <p class="label">${esc(t('o.question'))}</p><div class="chips">${CULTURES.map(c => `<button class="chip ${S.culture === c.id ? 'on' : ''}" data-c="${c.id}">${c.native}<br><small>${c.en}</small></button>`).join('')}</div></div>
    <div class="card"><p class="label">${esc(t('o.where'))}</p><p class="small muted">${esc(t('o.whereNote'))}</p><div id="pp"></div></div>`;
  $('#main').querySelectorAll('[data-c]').forEach(b => b.onclick = async () => { S.culture = b.dataset.c; save(); await loadPack(); onboarding(); });
  placePicker($('#pp'), async p => { S.home = p; if (onbFresh && !S.onboardProfile) S.onboardProfile = 'pending'; save(); await resetCalendars(); render(); });
}
// The last step: what a person in the app brings, that it all stays in this browser, and add one or not now.
// Either answer is kept (S.onboardProfile 'done' or 'skipped') and the step is not shown again.
function onboardProfile() {
  $('#tabs').innerHTML = '';
  const ic = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const lines = [
    ['<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>', 'r2.onbStar'],
    ['<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4"/>', 'r2.onbDays'],
    ['<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/>', 'r2.onbBirthdays'],
    ['<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>', 'r2.onbMatch']];
  $('#main').innerHTML = `<div class="card onbp"><h1 class="serif rise" style="--i:0">${esc(t('r2.onbTitle'))}</h1>
    ${lines.map(([d, k], i) => `<div class="onbline rise" style="--i:${i + 1}"><span class="onbic">${ic(d)}</span><span>${esc(t(k))}</span></div>`).join('')}
    <div class="onblock rise" style="--i:5"><span class="onbic">${ic('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')}</span><span>${esc(t('r2.onbPrivateWeb'))}</span></div>
    <div class="rise" style="--i:6"><button class="btn block" data-onb="add">＋ ${esc(t('r2.onbAdd'))}</button><button class="btn soft block" data-onb="skip" style="margin-top:8px">${esc(t('r2.onbSkip'))}</button></div></div>`;
  $('#main').querySelectorAll('[data-onb]').forEach(b => b.onclick = async () => {
    const add = b.dataset.onb === 'add';
    S.onboardProfile = add ? 'done' : 'skipped'; save(); onbFresh = false;
    tab = add ? 'people' : 'home'; await render();
    if (add) personEditor(null);
  });
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
let homeTick = null, turnTimer = null, holdTurns = false;
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Now and then one card turns over, chosen at random among those on screen, never the same twice running; it comes
// back by itself. One loop per screen: a new one, or a new screen, ends the last. The setting keeps them all still;
// asking the browser for less motion makes them fade instead of turn.
function startTurns(root, sel) {
  clearTimeout(turnTimer);
  if (S.tileFlip === false) return;
  const view = tab, id = e => e.dataset.k || e;
  let last = null;
  const tick = () => {
    if (tab !== view || !root.isConnected) return;
    // Nothing turns while a tile is dragged or a menu or sheet is open: one moving thing at a time.
    const els = document.hidden || holdTurns || document.querySelector('.pmenu, .overlay') ? [] : [...root.querySelectorAll(sel)].filter(e => {
      if (!e.querySelector(':scope > .tback') || id(e) === last || e.classList.contains('turned')) return false;
      const r = e.getBoundingClientRect(); return r.height && r.bottom > 0 && r.top < innerHeight;
    });
    const el = els[Math.floor(Math.random() * els.length)];
    const every = Math.max(3, S.tileFlipEvery || 5) * 1000;
    if (el) { last = id(el); el.classList.add('turned'); setTimeout(() => el.classList.remove('turned'), Math.min(4200, every * .6 + 1000)); }
    turnTimer = setTimeout(tick, every * (.8 + Math.random() * .4));
  };
  turnTimer = setTimeout(tick, 1200);
}
const startFlips = root => startTurns(root, '.tile.turn');
// A lacquered back for any turning card: a caption, one fact and a line, in a colour family (gold, maroon, green...).
const lacquer = (b, fam = 'gold', wide = false) => b && b.fact ? `<span class="tback tb-${fam}${wide ? ' wide' : ''}" aria-hidden="true"><span class="tbrings"></span><span class="tbframe"></span>
  ${b.caption ? `<span class="tbcap">${esc(b.caption)}</span>` : ''}<span class="tbfact">${esc(b.fact)}</span>${b.line ? `<span class="tbline">${esc(b.line)}</span>` : ''}</span>` : '';
// Turns a card over to new content: out to its edge, the content changed, back in. A cross-fade when the
// browser is asked for less motion or turning is off.
function turnSwap(el, html) {
  const how = still() || S.tileFlip === false ? ['fadeout', 'fadein'] : ['tyout', 'tyin'];
  return new Promise(res => {
    el.classList.add(how[0]);
    setTimeout(() => { el.classList.remove(how[0]); el.innerHTML = html; el.classList.add(how[1]); setTimeout(() => { el.classList.remove(how[1]); res(); }, 320); }, 300);
  });
}
// A number counting up to its value; at once when motion is reduced.
function countUp(el, to, ms = 900, fmt = String) {
  if (!el) return;
  if (still()) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = now => { const f = Math.min(1, (now - t0) / ms); el.textContent = f < 1 ? String(Math.floor(to * (1 - (1 - f) ** 3))) : fmt(to); if (f < 1 && el.isConnected) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
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
  const o = sheet(`<button class="btn soft infob noprint" data-dinfo aria-label="${esc(t('r3.what'))}" title="${esc(t('r3.what'))}">i</button><div id="dial" class="dialwrap"></div>`);
  o.classList.add('full');
  o.querySelector('[data-dinfo]').onclick = () => explainer('dial');
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
  const label = k => ({ festivals: t('tab.festivals'), day: t('dm.title'), dial: t('r3.dial'), vrats: t('vj.title'), calendar: t('tab.calendar'), jathakam: t('jk.chart'), sky: t('sk.title'), temples: t('tm.title'), people: t('fam.family'), match: t('mt.label'), greetings: t('gr.title'), birthstar: t('bs.result'), settings: t('tab.settings'), prayers: t('py.title'), games: t('gm.menu'), oldtime: t('ot.title') })[k] || k;
  const o = sheet('<div id="arr"></div>');
  const draw = () => {
    o.querySelector('#arr').innerHTML = `<h2 class="serif">${esc(t('hm.arrange'))}</h2>
      <p class="label">${esc(t('ar.style'))}</p><div class="chips">${TILE_STYLES.map(st => `<button class="chip ${S.tileStyle === st ? 'on' : ''}" data-st="${st}">${esc(t('ar.s.' + st))}</button>`).join('')}</div>
      <label class="list-row"><input type="checkbox" data-flip ${S.tileFlip !== false ? 'checked' : ''}><span class="grow">${esc(t('hm.flip'))}</span></label>${S.tileFlip !== false ? `<div class="seg" style="margin-top:8px" aria-label="${esc(t('hm.flipEvery'))}">${[3, 5, 10, 20, 30].map(n => `<button data-fe="${n}" class="${(S.tileFlipEvery || 5) === n ? 'on' : ''}">${esc(t('hm.secs', String(n)))}</button>`).join('')}</div>` : ''}
      <div class="card"><button class="linkbtn block" data-auto>✨ ${esc(t('ar.auto'))}</button><button class="linkbtn block" data-shuf>🔀 ${esc(t('ar.shuffle'))}</button><button class="linkbtn block" data-reset>↺ ${esc(t('ar.reset'))}</button>
      <p class="small muted">${esc(t('ar.autoNote'))}</p></div>
      <p class="label">${esc(t('ar.order'))}</p><div class="card">${order.map((k, i) => `<div class="list-row"><span class="grow">${esc(label(k))}</span><button class="arrow" data-up="${i}" aria-label="Up">↑</button><button class="arrow" data-dn="${i}" aria-label="Down">↓</button></div>`).join('')}</div>
      <button class="btn block" data-done>${esc(t('c.done'))}</button>`;
    const q = (sel, f) => o.querySelectorAll(sel).forEach(b => b.onclick = () => { f(b); draw(); });
    q('[data-st]', b => { S.tileStyle = b.dataset.st; });
    o.querySelector('[data-flip]').onchange = e => { S.tileFlip = e.target.checked; save(); draw(); };
    q('[data-fe]', b => { S.tileFlipEvery = +b.dataset.fe; save(); });
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
// The tiles' line icons (24-unit strokes), shared by Home, its menus and the explainers.
const HOME_ICONS = {
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
  dial: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/><path d="M12 12l3.5-3.5"/>',
  muhurtham: '<circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="M10 4l2 3 2-3"/>',
  games: '<path d="M5 21 9 3M10.5 21l4-18"/><path d="M6.3 16h4.5M7.4 11.5h4.5M8.5 7h4.5"/><path d="M20 4c-3 2 1 5-2 8s1 5-2 8"/>',
};
async function viewHome() {
  await loadPrayers().catch(() => {});
  const d = today();
  dayDate = null; dayPlace = null;
  loading();
  const p = await day(d);
  const fine = await engine({ op: 'timings', handle: await cal(+d.slice(0, 4)), date: d }).catch(() => null);
  const coming = await upcoming(d, 180);
  const fest = coming.find(x => x.f.tier !== 'minor' && x.date <= addDays(d, 90));
  const vigil = coming.find(x => VIGIL.test(x.f.id));
  const greet = coming.find(x => x.f.tier !== 'minor');
  const vrat = (await vratDays(d, addDays(d, 14)))[0];
  const now = Date.now() / 1000;
  const persons = [];
  for (const x of S.people) {
    if (!x.anchor) continue;
    for (const y of [+d.slice(0, 4), +d.slice(0, 4) + 1]) {
      const ds = await engine({ op: 'personalDates', handle: await cal(y), anchor: x.anchor, kind: x.kind || 'birthday', basis: x.basis }).catch(() => []);
      const next = ds.find(s => s >= d && s <= addDays(d, 60));
      if (next) persons.push({ p: x, date: next });
    }
  }
  persons.sort((a, b) => a.date < b.date ? -1 : 1);
  const person = persons[0] || null;
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
  const icon = k => HOME_ICONS[k];
  const svg = k => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon(k)}</svg>`;
  // The tiles: a colour family each; the front holds the chip, the feature's name in the serif, a glimpse of what is
  // inside and a line beneath; the back (turned to now and then) a caption, one fact and a line.
  const FAM = { festivals: 'gold', day: 'clay', dial: 'gold', calendar: 'clay', vrats: 'maroon', prayers: 'green', games: 'indigo', oldtime: 'gold', people: 'clay', match: 'maroon', greetings: 'gold', sky: 'indigo', temples: 'gold', jathakam: 'indigo', birthstar: 'gold', settings: 'quiet' };
  const chips = xs => xs.length ? `<span class="chips">${xs.slice(0, 3).map(x => `<span>${esc(x)}</span>`).join('')}</span>` : '';
  const backOf = (label, k, b) => b && b.fact ? `<span class="tback" aria-hidden="true"><span class="tbrings"></span><span class="tbframe"></span><span class="tbsym">${svg(k)}</span>
      <span class="tbname">${esc(label)}</span><span class="tbcap">${esc(b.caption)}</span><span class="tbfact">${esc(b.fact)}</span>${b.line ? `<span class="tbline">${esc(b.line)}</span>` : ''}</span>` : '';
  const tile = (k, go, label, o = {}) => {
    const fam = FAM[k] || 'clay';
    if (o.row) return `<button class="tile trow ${fam}" data-go="${go}" data-k="${k}" draggable="true"><span class="ic">${svg(k)}</span><span class="lb">${esc(label)}</span><span class="val">${esc(o.value || '')}</span><span class="chev" aria-hidden="true">›</span></button>`;
    const front = o.featured ? o.glimpse
      : `<span class="thead"><span class="ic">${svg(k)}</span>${o.art || ''}</span><span class="lb">${esc(label)}</span><span class="gl">${o.glimpse || ''}</span>${o.detail ? `<span class="dt">${esc(o.detail)}</span>` : ''}`;
    return `<button class="tile turn ${fam}${o.featured ? ' featured' : ''}" data-go="${go}" data-k="${k}" draggable="true"><span class="tfront">${front}</span>${backOf(label, k, o.back)}</button>`;
  };
  // What the glimpses and backs draw on.
  const more = coming.filter(x => x.f.tier !== 'minor' && x.date !== fest?.date);
  const tomorrow = await day(addDays(d, 1)).catch(() => null);
  const shortDate = s => dtf({ day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parse(s));
  const wd = parse(d).getUTCDay(), weekStart = addDays(d, -wd);
  const letters = [...Array(7)].map((_, i) => dtf({ weekday: 'narrow', timeZone: 'UTC' }).format(parse(addDays(weekStart, i))));
  const week = [...Array(7)].map((_, i) => { const s = addDays(weekStart, i); return `<span class="${s === d ? 'on' : ''}">${+s.slice(8)}</span>`; });
  const log = Object.entries(S.vratLog).sort((a, b) => a[0].split('|')[1] < b[0].split('|')[1] ? -1 : 1).slice(vrat ? -6 : -7).map(x => x[1]);
  const dots = [...log, ...(vrat ? [null] : [])];
  const tp = PRAYERS ? todayPrayer() : null;
  const verse = tp?.text?.[prayerScript()]?.[0]?.split('\n') || [];
  const since = (() => { let s = now - p.sunrise; if (s < 0) s += 86400; return [Math.floor(s / 1440), Math.floor((s % 1440) / 24)]; })();
  const units = timeUnitNames();
  const initials = [...S.people.slice(0, 3).map(x => (x.name || '?')[0].toUpperCase()), ...(S.people.length > 3 ? ['+' + (S.people.length - 3)] : [])];
  const personText = x => t(x.p.kind === 'remembrance' ? 'pp.remembranceOf' : 'pp.birthdayOf', x.p.name);
  const star = p.nakshatras[0] ? name('nakshatras', p.nakshatras[0].key) : '';
  const nextPeriod = i >= 0 && ch[i + 1] ? { caption: t('tb.period'), fact: plabel(ch[i + 1].key), line: t('tb.from', clock(ch[i + 1].start)) } : null;
  const deities = ['vishnu', 'shiva', 'devi'].map(x => t('deity.' + x));
  const dashas = [t('jk.vimshottari'), t('jk.yogini'), t('jk.chara')].join(' · ');
  const bar = (() => { const span = p.sunset - p.sunrise, a = Math.max(0, Math.min(1, (p.rahuKalam.start - p.sunrise) / span)), b = Math.max(a, Math.min(1, (p.rahuKalam.end - p.sunrise) / span));
    return `<span class="gbar"><i style="left:${(a * 100).toFixed(1)}%;width:${Math.max(1.5, (b - a) * 100).toFixed(1)}%"></i></span><span class="gtimes"><span>${esc(clock(p.sunrise))}</span><span>${esc(clock(p.sunset))}</span></span>`; })();
  // The dial in small: the running half's periods round a ring, by their nature, the hand at now.
  const dialRing = (() => {
    if (!ch.length) return '';
    const isDay = now >= p.sunrise && now < p.sunset, early = now < p.sunrise;
    const a = isDay || early ? p.sunrise : p.sunset, b = isDay || early ? p.sunset : (tomorrow?.sunrise || p.sunset + 43200);
    const segs = ch.filter(x => x.start >= a - 60 && x.end <= b + 60); if (!segs.length) return '';
    const nat = x => kind === 'hora' ? (['moon', 'mercury', 'jupiter', 'venus'].includes(x.key) ? 0 : 1) : x.key === 'chara' ? 1 : FAVOURED.has(x.key) ? 0 : 2;
    const C = 32, R = 24, ang = u => (u - a) / (b - a) * Math.PI * 2 - Math.PI / 2, pt = (r, an) => `${(C + Math.cos(an) * r).toFixed(1)} ${(C + Math.sin(an) * r).toFixed(1)}`;
    const arc = (u0, u1) => { const g = (b - a) * .006, a0 = ang(u0 + g), a1 = ang(u1 - g); return `M${pt(R, a0)}A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(R, a1)}`; };
    const col = n => n === 0 ? 'var(--tint)' : n === 1 ? 'color-mix(in srgb, var(--tint) 45%, transparent)' : 'var(--sunken)';
    const hand = now >= a && now < b ? `<line x1="${C}" y1="${C}" x2="${pt(R + 5, ang(now)).replace(' ', '" y2="')}" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/><circle cx="${C}" cy="${C}" r="2.5" fill="var(--ink)"/>` : '';
    return `<svg class="gring" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">${segs.map(x => `<path d="${arc(x.start, x.end)}" fill="none" stroke="${col(nat(x))}" stroke-width="7"/>`).join('')}${hand}</svg>`;
  })();
  const ART = {
    cards: '<span class="tart cards" aria-hidden="true"><i></i><b></b></span>',
    chart: '<svg class="tart" viewBox="0 0 52 52" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M1 1h50v50H1z M1 13.5h50 M1 38.5h50 M13.5 1v50 M38.5 1v50"/><circle cx="7" cy="45" r="2" fill="currentColor" stroke="none"/><circle cx="32" cy="7" r="2" fill="currentColor" stroke="none"/></svg>',
    stars: '<svg class="tart" viewBox="0 0 56 44" aria-hidden="true"><path d="M8 30L20 22 30 26 42 12 50 18" fill="none" stroke="currentColor" stroke-width="1" opacity=".5"/><circle cx="8" cy="30" r="2.2" fill="currentColor"/><circle cx="20" cy="22" r="3" fill="currentColor"/><circle cx="30" cy="26" r="2" fill="currentColor"/><circle cx="42" cy="12" r="3.2" fill="currentColor"/><circle cx="50" cy="18" r="2" fill="currentColor"/></svg>',
  };
  const tiles = [
    tile('festivals', 'festivals', t('tab.festivals'), fest ? {
      featured: true,
      glimpse: `<span class="thead"><span class="ic">${svg('festivals')}</span><span class="lb">${esc(t('tab.festivals'))}</span><span class="all">${esc(t('f.all'))} ›</span></span>
        <span class="leafrow"><span class="leaf"><b>${esc(dtf({ weekday: 'short', timeZone: 'UTC' }).format(parse(fest.date)).toUpperCase())}</b><i>${+fest.date.slice(8)}</i></span><span class="leaftx"><b>${esc(fname(fest.f))}</b><span>${esc(when(fest.date))}</span></span></span>
        ${chips(more.slice(0, 2).map(x => `${fname(x.f)} · ${when(x.date)}`))}`,
      back: more[0] && { caption: t('tb.next'), fact: fname(more[0].f), line: `${when(more[0].date)} · ${shortDate(more[0].date)}` },
    } : { detail: t('f.upcoming') }),
    tile('day', 'today', t('dm.title'), { glimpse: bar, detail: chog ? `${chog[0]} · ${chog[1]}` : t('time.section'), back: nextPeriod }),
    tile('dial', 'dial', t('r3.dial'), { glimpse: dialRing, detail: chog ? `${plabel(ch[i].key)} · ${t('p.until', clock(ch[i].end))}` : t('time.section'), back: nextPeriod }),
    tile('calendar', 'calendar', t('tab.calendar'), { glimpse: `<span class="gweek">${letters.map(l => `<em>${esc(l)}</em>`).join('')}${week.join('')}</span>`, detail: greg(d, { month: 'long', year: 'numeric' }),
      back: tomorrow && { caption: t('day.tomorrow'), fact: [tomorrow.tithis[0] && name('tithis', tomorrow.tithis[0].key), tomorrow.nakshatras[0] && name('nakshatras', tomorrow.nakshatras[0].key)].filter(Boolean).join(', '), line: `${clock(tomorrow.sunrise)} · ${clock(tomorrow.sunset)}` } }),
    tile('vrats', 'vrats', t('vj.title'), { glimpse: dots.length ? `<span class="gdots">${dots.map(k => `<i class="${k === true ? 'k' : k === null ? 'n' : ''}"></i>`).join('')}</span>` : '',
      detail: vrat ? `${recName(vrat.key)} · ${when(vrat.date)}` : kept ? t('vj.keptOf', String(kept)) : t('v.title'),
      back: { caption: t('tb.yours'), fact: t('vj.keptOf', String(kept)), line: vrat ? `${recName(vrat.key)} · ${when(vrat.date)}` : '' } }),
    tile('prayers', 'prayers', t('py.title'), { glimpse: verse[0] ? `<span class="gscript">${esc(verse[0])}</span>` : '', detail: tp ? prayerTitle(tp) : t('pr.today'),
      back: tp && { caption: t('tb.verse'), fact: verse.slice(0, 2).join('\n'), line: prayerTitle(tp) } }),
    tile('games', 'games', t('gm.menu'), { glimpse: chips(['pp', 'pl', 'ap'].map(g => t(gameKey(g, S.culture)))), detail: vigil ? `${fname(vigil.f)} · ${vigil.date === d ? t('gm.tonight') : when(vigil.date)}` : t('gm.tagline'),
      back: { caption: t('gm.fromTradition'), fact: t(gameKey('pp', S.culture)), line: ['pl', 'ap'].map(g => t(gameKey(g, S.culture))).join(' · ') } }),
    tile('oldtime', 'oldtime', t('ot.title'), { glimpse: `<span class="gnums"><b>${since[0]}</b><small>${esc(units[0])}</small><b>${since[1]}</b><small>${esc(units[1])}</small></span>`, detail: t('ot.toTrad', units[0]),
      back: { caption: t('tb.old'), fact: t('tb.unit', units[0]), line: t('tb.sixty', units[0]) } }),
    tile('people', 'people', t('fam.family'), { glimpse: initials.length ? `<span class="ginit">${initials.map(x => `<i>${esc(x)}</i>`).join('')}</span>` : '', detail: person ? `${personText(person)} · ${when(person.date)}` : t('pp.add'),
      back: persons[1] && { caption: t('tb.next'), fact: personText(persons[1]), line: `${when(persons[1].date)} · ${shortDate(persons[1].date)}` } }),
    ...(matchingAvailable() ? [tile('match', 'match', t('mt.label'), { glimpse: S.people.length >= 2 ? chips(S.people.slice(0, 2).map(x => x.name)) : '', detail: t(matchesByPorutham() ? 'mt.ten' : 'mt.eight'),
      back: { caption: t('tb.ways'), fact: matchTitle(), line: t('tb.asTradition') } })] : []),
    tile('greetings', 'greetings', t('gr.title'), { art: ART.cards, detail: greet ? t('gr.send', fname(greet.f)) : t('gr.card'),
      back: (() => { const g = more.find(x => x.date !== greet?.date); return g && { caption: t('tb.next'), fact: t('gr.send', fname(g.f)), line: when(g.date) }; })() }),
    tile('sky', 'sky', t('sk.title'), { glimpse: '<span class="gmoons"><i></i><i></i><i></i><i></i></span>', detail: t('sk.now'),
      back: p.moonrise && { caption: t('tb.tonight'), fact: `${t('sun.moonrise')} ${clock(p.moonrise)}`, line: star ? t('tb.moonIn', star) : '' } }),
    tile('temples', 'temples', t('tm.title'), { glimpse: chips(deities), detail: t('tm.deity'), back: { caption: t('tm.deity'), fact: t('tm.near', S.home.name), line: deities.join(' · ') } }),
    tile('jathakam', 'jathakam', t('jk.chart'), { art: ART.chart, detail: dashas, back: { caption: t('jk.title'), fact: starPerson()?.name || t('jk.chart'), line: dashas } }),
    tile('birthstar', 'birthstar', t('bs.result'), { art: ART.stars, detail: t('bs.title'),
      back: p.nakshatras[0] && { caption: t('tb.todayStar'), fact: star, line: t('tb.ofStars', (p.nakshatras[0].index ?? 0) + 1) } }),
    tile('settings', 'settings', t('tab.settings'), { row: true, value: c ? (S.native ? c.native : c.en) : '' }),
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
  $('#main').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { if (b.dataset.go === 'dial') return openDial(today()); tab = b.dataset.go; if (tab === 'games') GM.screen = null; render(); scrollTo(0, 0); });
  // Long press or right-click a tile: its shortcuts and what it is.
  onHold($('#main .wide[data-go="muhurtham"]'), (x, y) => popMenu(x, y, [{ label: t('r3.what'), icon: 'info', fn: () => explainer('muh') }]));
  $('#main').querySelectorAll('.tile[data-k]').forEach(el => { if (el.dataset.k !== 'settings' && el.dataset.k !== 'greetings' && el.dataset.k !== 'jathakam') onHold(el, (x, y) => tileMenu(el.dataset.k, x, y, { fest, tp })); });
  animateSky($('#main').querySelector('svg.sky'));
  $('#main').querySelector('[data-dial]').onclick = e => { e.stopPropagation(); openDial(today()); };
  $('#main').querySelectorAll('[data-ts]').forEach(b => b.onclick = () => { S.textSize = Math.max(0, Math.min(TEXT_SIZES.length - 1, S.textSize + +b.dataset.ts)); save(); applyTextSize(); });
  $('#main').querySelector('[data-arrange]').onclick = () => arrangeSheet(tiles.map(x => x.match(/data-k="([^"]+)"/)[1]), { fest, greet, vrat, person, d });
  // Drag a tile onto another to put it there.
  wireTileDrag($('#main .tiles'));
  startFlips($('#main'));
  clearInterval(homeTick);
  homeTick = setInterval(() => { if (tab !== 'home' || !$('#clocks')) return clearInterval(homeTick); $('#clocks').textContent = clocks(); $('#nazhika').textContent = sinceSunrise(p.sunrise); }, 30000);
  // The year's sky takes a few seconds; its tile fills in when ready, next year only if this one is over.
  const y = +d.slice(0, 4);
  let sky = (await skyEvents(y).catch(() => [])).find(e => e.at > now);
  if (!sky) sky = (await skyEvents(y + 1).catch(() => [])).find(e => e.at > now);
  const el = tab === 'home' && $('#main .tile[data-go="sky"] .tfront .dt');
  if (el && sky) el.textContent = `${skyTitle(sky)} · ${dtf({ day: 'numeric', month: 'short', timeZone: S.home.tz }).format(new Date(sky.at * 1000))}`;
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
  // What each limb turns to now and then: the one that follows it, and when.
  const next = (list, table) => list?.[1] ? t('dial.nextAt', name(table, list[1].key), clock(list[1].start ?? list[0].end)) : '';
  const WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const vara = p.nextSunrise && WEEK.includes(p.weekday) ? t('dial.nextAt', name('weekdays', WEEK[(WEEK.indexOf(p.weekday) + 1) % 7]), clock(p.nextSunrise)) : '';
  const [tv, td] = limb(p.tithis, 'tithis'), [nv, nd] = limb(p.nakshatras, 'nakshatras'), [yv, yd] = limb(p.yogas, 'yogas'), [kv, kd] = limb(p.karanas, 'karanas');
  const fests = p.occurrences.filter(o => !o.recurring).map(o => ({ o, f: pack.festivals.find(f => f.id === o.id) })).filter(x => x.f && !x.f.hidden);
  const recs = [...new Set(p.occurrences.filter(o => o.recurring && (!pack.dailySignificance.find(r => r.key === o.id)?.optIn || S.vrats.includes(o.id))).map(o => o.id))];
  const people = await peopleOn(d);
  const checkIns = d === today() && !dayPlace ? await vratCheckIns() : [];
  // A period still to come, for this day only: on the web, a calendar file with an alert 10 minutes before
  // (a page cannot alert once it is closed).
  const calWins = [];
  const calBtn = (k, w) => { if (!w || w.end <= Date.now() / 1000) return ''; calWins.push([k, w]);
    return ` <button class="calbtn noprint" data-calw="${calWins.length - 1}" title="${esc(t('r3w.addToCal'))}" aria-label="${esc(t('r3w.addToCal') + ': ' + t(k))}">🗓</button>`; };
  const skyToday = dayPlace ? [] : (await skyEvents(+d.slice(0, 4)).catch(() => [])).filter(e => new Intl.DateTimeFormat('en-CA', { timeZone: S.home.tz }).format(new Date(e.at * 1000)) === d);
  $('#main').innerHTML = `
    ${checkIns.slice(0, 3).map(checkInCard).join('')}
    <div class="dayhead"><div class="nav"><button class="arrow" data-shift="-1" aria-label="Previous day">‹</button>
      <div><h1 class="serif">${esc(cultureDate(p.solar, p.lunar))}</h1><div class="muted">${esc(greg(d))}</div><div class="small muted">${esc(yearLabel(p.year))}</div>
      <div class="small muted">📍 ${esc(t('f.forPlace', here().name))}</div></div>
      <button class="arrow" data-shift="1" aria-label="Next day">›</button></div>
      ${d !== today() ? `<button class="btn soft noprint" data-today>${esc(t('day.jumpToday'))}</button>` : ''}<button class="btn soft noprint" data-dialday>◷ ${esc(t('dial.open'))}</button> <button class="btn soft noprint" data-addnote>＋ ${esc(t('r3.addNote'))}</button></div>
    ${fests.length || recs.length || people.length || skyToday.length ? `<p class="label">${esc(t('day.observances'))}</p>` : ''}
    ${skyToday.map(e => `<div class="rec" data-goto-sky style="cursor:pointer">✦ ${esc(skyTitle(e))} · ${esc(clock(e.at))}</div>`).join('')}
    ${fests.map(({ f, o }) => `<div class="fest ${f.tier === 'major' ? 'major' : ''}" data-f="${esc(f.id)}" data-d="${o.date}"><div class="bar2"></div><div><b>${esc(fname(f))}</b><div class="small muted">${esc(fother(f))}</div><div class="small muted">${esc(text(f.content?.summary))}</div></div><div class="when">›</div></div>`).join('')}
    ${people.map(x => `<div class="rec">🎁 <b>${esc(x.title)}</b> <span class="small muted">${esc(x.line)}</span></div>`).join('')}
    ${recs.map(k => { const r = pack.dailySignificance.find(r => r.key === k); return `<div class="rec">🌙 <b>${esc(recName(k))}</b>${/sank/.test(k) && p.moonrise ? ` <span class="small" style="color:var(--accent);font-weight:700">· ${esc(t('sun.moonrise'))} ${esc(clock(p.moonrise))}</span>` : ''}<div class="small muted">${esc(text(r?.content?.summary))}</div></div>`; }).join('')}
    ${parana ? `<div class="card"><p class="label">${esc(t('v.parana'))}</p><div style="font-size:20px;font-weight:700">${esc(span(parana))}</div>${parana.dvadashiEnd ? `<div class="small muted">${esc(t('v.dvadashiEnds', clock(parana.dvadashiEnd)))}</div>` : ''}<div class="small muted">${esc(t('v.paranaWhy'))}</div></div>` : ''}
    <div id="daynotes"></div>
    <div class="card"><p class="label">${esc(t('p.panchang'))}</p>
      ${[[t('p.tithi'), (p.lunar ? name('paksha', p.lunar.paksha) + ' ' : '') + tv, td, next(p.tithis, 'tithis')], [t('mw.vara'), name('weekdays', p.weekday), p.nextSunrise ? t('p.until', clock(p.nextSunrise)) : '', vara],
        [t('p.nakshatra'), nv, nd, next(p.nakshatras, 'nakshatras')], [t('p.yoga'), yv, yd, next(p.yogas, 'yogas')], [t('p.karana'), kv, kd, next(p.karanas, 'karanas')]]
        .map(([l, v, s, b]) => `<div class="row limb${b ? ' turn v' : ''}"><span class="tfront"><span class="muted">${esc(l)}</span><span class="v">${esc(v)}<small>${esc(s)}</small></span></span>${lacquer(b && { caption: l, fact: b }, 'clay', true)}</div>`).join('')}</div>
    ${fine && starPerson() ? starCard(starPerson(), p, fine, d) : ''}
    ${fine ? dayDetail(p, fine, d) : ''}
    <div class="card sun">${[['sun.sunrise', p.sunrise], ['sun.sunset', p.sunset], ['sun.moonrise', p.moonrise], ['sun.moonset', p.moonset]]
        .map(([k, u]) => `<div><b>${u ? esc(clock(u)) : esc(t('sun.none'))}</b><span class="small muted">${esc(t(k))}</span></div>`).join('')}</div>
    <div class="card"><p class="label">${esc(t('time.section'))}</p><div class="small muted">${esc(t('time.avoid'))}</div>
      ${[['time.rahu', p.rahuKalam], ['time.yama', p.yamagandam], ['time.gulika', p.gulikaKalam]].map(([k, w]) => `<div class="row"><span>${esc(t(k))}</span><span class="v">${esc(span(w))}${calBtn(k, w)}</span></div>`).join('')}
      ${fine ? [['time.durmuhurtam', fine.durmuhurtam], ['time.varjyam', fine.varjyam], ['time.bhadra', fine.bhadra], ['time.panchaka', fine.panchaka]].map(([k, ps]) => windowsRow(k, ps, d)).join('') : ''}
      <div class="small muted" style="margin-top:8px">${esc(t('time.favoured'))}</div>
      <div class="row"><span>${esc(t('time.abhijit'))}</span><span class="v">${esc(p.weekday === 'wednesday' ? t('time.abhijitNone') : span(p.abhijit))}${p.weekday === 'wednesday' ? '' : calBtn('time.abhijit', p.abhijit)}</span></div>
      ${fine ? windowsRow('time.amrit', fine.amritKalam, d) : ''}
      ${[['time.brahma', p.brahmaMuhurta]].map(([k, w]) => `<div class="row"><span>${esc(t(k))}</span><span class="v">${esc(span(w))}${calBtn(k, w)}</span></div>`).join('')}
      ${calWins.length ? `<p class="small muted noprint" style="margin-top:8px">🗓 ${esc(t('r3w.alertWeb'))}</p>` : ''}</div>
    ${fine ? `<div class="card" id="mcard">${muhurtasCard(fine, d)}</div>` : ''}
    <button class="btn soft block noprint" onclick="window.print()">${SHARE_ICON} ${esc(t('pdf.share'))}</button>`;
  $('#main').querySelector('[data-dialday]')?.addEventListener('click', () => openDial(d));
  $('#main').querySelectorAll('[data-calw]').forEach(b => b.onclick = () => { const [k, w] = calWins[+b.dataset.calw];
    icsFile(`${t(k)} ${d}`, [{ uid: `${k}-${d}-${here().name}`, start: w.start, end: w.end, title: t('r3.alertTitle', t(k), clock(w.start)), text: `${greg(d)} · ${here().name}`, alarms: ['-PT10M'] }]); });
  // The day's own notes and events, and one more.
  const notesBox = $('#main').querySelector('#daynotes');
  const drawNotes = () => { notesBox.innerHTML = noteRows(d); wireNoteRows(notesBox, d, drawNotes); };
  drawNotes();
  $('#main').querySelector('[data-addnote]').onclick = () => noteEditor(d, null, drawNotes);
  $('#main').querySelectorAll('[data-shift]').forEach(b => b.onclick = () => { dayDate = addDays(d, +b.dataset.shift); tab = 'today'; viewDay(); });
  $('#main').querySelector('[data-today]')?.addEventListener('click', () => { dayDate = null; viewDay(); });
  wireCheckIns();
  $('#main').querySelectorAll('[data-goto-sky]').forEach(x => x.onclick = () => { tab = 'sky'; render(); });
  wireMuhurtas(fine, d);
  wireFestivals();
  startTurns($('#main'), '.limb.turn');
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
// The longest run ever kept in a row: for one vrat, or the best of any.
function vratBest(key) {
  const keys = key ? [key] : [...new Set(Object.keys(S.vratLog).map(id => id.split('|')[0]))];
  return Math.max(0, ...keys.map(k => { let best = 0, run = 0;
    for (const [, kept] of Object.entries(S.vratLog).filter(([id]) => id.startsWith(k + '|')).sort((a, b) => a[0] < b[0] ? -1 : 1)) { run = kept ? run + 1 : 0; best = Math.max(best, run); }
    return best; }));
}
// Kept and answered, all time or in a year: "Kept 18 of 21 · 86%".
function vratRate(year) {
  const xs = Object.entries(S.vratLog).filter(([id]) => !year || id.split('|')[1].startsWith(year));
  const kept = xs.filter(([, k]) => k).length;
  return xs.length ? t('vj.rate', String(kept), String(xs.length), Math.round(kept / xs.length * 100) + '%') : '';
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
  // The star drops in and lands; a burst of sparks as it does; the run rolls up to its number.
  const sparks = Array.from({ length: 16 }, (_, i) => `<i style="--a:${i * 22.5}deg;--r:${i % 2 ? 92 : 128}px;--c:${i % 3 ? 'var(--gold)' : 'var(--accent)'}">${i % 2 ? '✦' : '★'}</i>`).join('');
  const from = Math.max(1, run - 6), roll = `<span class="roll" style="--n:${run - from}"><span>${Array.from({ length: run - from + 1 }, (_, i) => `<b>${from + i}</b>`).join('')}</span></span>`;
  o.innerHTML = `<div class="cel-card" role="dialog" aria-modal="true"><div class="cel-star">${sparks}<span>★</span></div>
    <h2 class="serif">${esc(t('vj.done'))}</h2><div class="cel-count">${Math.max(0, count - 10)}</div>
    <div><b>${esc(t('vj.keptOf', recName(key)))}</b></div>
    <div class="cel-pills">${run > 1 ? `<span class="pill">🔥 ${esc(t('vj.run', '\u0000')).replace('\u0000', roll)}</span>` : ''}<span class="pill">📅 ${esc(t('vj.year', year))}</span></div>
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

// A whole year of vrats, month by month: a star for each kept, a moon where not this time, a ring where still to mark.
let vyYear = null;
async function vratYear() {
  const thisYear = +today().slice(0, 4), y = Math.min(vyYear || thisYear, thisYear);
  const days = await vratDays(`${y}-01-01`, `${y}-12-31`);
  for (const id of Object.keys(S.vratLog)) { const [key, date] = id.split('|'); if (date.startsWith(y + '-') && !days.some(e => e.id === id)) days.push({ key, date, id }); }
  days.sort((a, b) => a.date < b.date ? -1 : 1);
  // Each month rises in its turn and its marks pop in left to right; a month still to come is dim, and under
  // each month that has begun, how many were kept of the days come so far.
  const td = today(), mon = dtf({ month: 'short', timeZone: 'UTC' });
  const mark = (e, j, i) => { const a = S.vratLog[e.id], d = `style="--d:${i * 80 + 120 + j * 30}ms"`;
    return a === true ? `<i class="k" ${d}>★</i>` : a === false ? `<i ${d}>☾</i>` : `<i class="${e.date > td ? 'f' : 'open'}" ${d}>◌</i>`; };
  const months = [...Array(12)].map((_, i) => { const mm = `${y}-${pad(i + 1)}`, here = days.filter(e => e.date.startsWith(mm));
    const past = here.filter(e => e.date <= td), kept = past.filter(e => S.vratLog[e.id] === true).length;
    return `<div class="vy-row rise${mm > td.slice(0, 7) ? ' fut' : ''}" style="--i:${i}"><span class="vy-m">${esc(mon.format(parse(mm + '-15')))}${past.length ? `<small>${esc(t('r2.kept', String(kept), String(past.length)))}</small>` : ''}</span><span class="vy-marks">${here.length ? here.map((e, j) => mark(e, j, i)).join('') : '<span class="muted">–</span>'}</span></div>`; }).join('');
  return `<div class="card"><p class="label">${esc(t('vj.glance'))}</p>
    <div class="dayhead" style="margin:0"><div class="nav"><button class="arrow" data-vy="-1">‹</button><b class="serif" style="font-size:20px">${y}</b><button class="arrow" data-vy="1" ${y >= thisYear ? 'disabled' : ''}>›</button></div></div>
    <p class="gold" style="font-weight:700;margin:6px 0">★ <span data-cu="${vratsKept(null, String(y))}">${vratsKept(null, String(y))}</span>${vratRate(String(y)) ? ` <span class="small muted" style="font-weight:400">· ${esc(vratRate(String(y)))}</span>` : ''}</p>
    <div class="vy">${months}</div><p class="small muted">${esc(t('vj.glanceNote'))}</p></div>`;
}

async function viewVrats() {
  loading();
  const choices = pack.dailySignificance.filter((r, i, a) => a.findIndex(x => x.key === r.key) === i);
  const recent = [];
  for (const v of await vratDays(addDays(today(), -30), today())) { const c = await vratCloses(v); if (c && c <= Date.now() / 1000) recent.push(v); }
  const icon = a => a === true ? '<span class="gold">★</span>' : a === false ? '☾' : '◌';
  $('#main').innerHTML = `<div class="card"><p class="label">${esc(t('vj.title'))}</p>
      ${S.vrats.length ? `<div class="journal-head"><span class="gold big">★</span><div><div class="big" data-cu="${vratsKept()}">${vratsKept()}</div><div class="small muted">${esc(t('vj.total'))}</div></div>
        <div class="small muted" style="margin-left:auto">${esc(t('vj.year', vratsKept(null, today().slice(0, 4))))}</div></div>
        ${vratBest() > 1 ? `<div class="row"><span>🔥 ${esc(t('vj.best', String(vratBest())))}</span></div>` : ''}
        ${vratRate(today().slice(0, 4)) ? `<div class="row"><span class="muted">${esc(t('vj.thisYear'))}</span><span class="v">${esc(vratRate(today().slice(0, 4)))}</span></div>` : ''}
        ${vratRate() && vratRate() !== vratRate(today().slice(0, 4)) ? `<div class="row"><span class="muted">${esc(t('vj.allTime'))}</span><span class="v">${esc(vratRate())}</span></div>` : ''}
        ${S.vrats.filter(k => vratsKept(k)).map(k => `<div class="row"><span>${esc(recName(k))}</span><span class="v">${vratRun(k) > 1 ? `<small style="display:inline">${esc(t('vj.run', vratRun(k)))} · </small>` : ''}${vratBest(k) > Math.max(vratRun(k), 1) ? `<small style="display:inline">${esc(t('vj.best', String(vratBest(k))))} · </small>` : ''}<span class="gold">★ ${vratsKept(k)}</span></span></div>`).join('')}
        <p class="small muted">${esc(t('vj.askBody'))}</p>` : `<p class="small muted">${esc(t('vj.empty'))}</p>`}</div>
    ${recent.length ? `<div class="card"><p class="label">${esc(t('vj.recent'))}</p>${recent.reverse().map(v => `<div class="list-row"><div class="grow">${esc(recName(v.key))}<div class="small muted">${esc(greg(v.date, { day: 'numeric', month: 'short', year: 'numeric' }))}</div></div>
        <button class="btn soft" data-mark="${esc(v.id)}" data-to="1" title="${esc(t('vj.kept'))}">★</button><button class="btn soft" data-mark="${esc(v.id)}" data-to="0" title="${esc(t('vj.notThisTime'))}">☾</button>
        <span style="width:28px;text-align:center;font-size:20px">${icon(S.vratLog[v.id])}</span></div>`).join('')}<p class="small muted">${esc(t('vj.recentNote'))}</p></div>` : ''}
    ${S.vrats.length || Object.keys(S.vratLog).length ? await vratYear() : ''}
    ${await vratCalendar()}
    <div class="card"><p class="label">${esc(t('vg.list'))}</p>${choices.map(r => `<details class="factor"><summary><span class="grow"><b>${esc(recName(r.key))}</b><span class="small muted" style="display:block">${esc(text(r.content?.summary))}</span></span></summary>
        ${r.content?.traditions ? `<p class="label" style="margin:10px 0 2px">${esc(t('vg.title'))}</p><p style="margin:0">${esc(text(r.content.traditions))}</p>` : ''}
        ${(r.content?.howTo?.[lang()] || r.content?.howTo?.en || []).length ? `<p class="label" style="margin:10px 0 2px">${esc(t('vg.steps'))}</p><ol style="margin:0;padding-left:20px">${(r.content.howTo[lang()] || r.content.howTo.en).map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
        <p class="small muted">${esc(t('vg.gentle'))}</p></details>`).join('')}</div>
    <div class="card"><p class="label">${esc(t('v.title'))}</p>${choices.map(r => `<label class="list-row" style="cursor:pointer"><div class="grow"><b>${esc(recName(r.key))}</b><div class="small muted">${esc(text(r.content?.summary))}</div></div>
        <input type="checkbox" data-v="${esc(r.key)}" ${S.vrats.includes(r.key) ? 'checked' : ''}></label>`).join('')}<p class="small muted">${esc(t('v.note'))}</p></div>`;
  // The journal's numbers count up to what they are.
  $('#main').querySelectorAll('[data-cu]').forEach(el => countUp(el, +el.dataset.cu));
  $('#main').querySelectorAll('[data-v]').forEach(c => c.onchange = () => {
    S.vrats = S.vrats.filter(k => k !== c.dataset.v); if (c.checked) S.vrats.push(c.dataset.v); save(); viewVrats();
  });
  $('#main').querySelectorAll('[data-mark]').forEach(b => b.onclick = () => { answerVrat(b.dataset.mark, b.dataset.to === '1'); viewVrats(); });
  $('#main').querySelectorAll('[data-vc]').forEach(b => b.onclick = () => {
    const d = parse(vcMonth || today().slice(0, 8) + '01'); d.setUTCMonth(d.getUTCMonth() + +b.dataset.vc, 1); vcMonth = ymd(d); viewVrats();
  });
  $('#main').querySelectorAll('[data-vf]').forEach(b => b.onclick = () => { vcFilter = b.dataset.vf || null; viewVrats(); });
  $('#main').querySelectorAll('[data-vy]').forEach(b => b.onclick = () => { vyYear = (vyYear || +today().slice(0, 4)) + +b.dataset.vy; viewVrats(); });
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
    <div class="card">${m.kootas.map((k, i) => `<div class="row fillin" style="--i:${i}"><span>${esc(t('gm.' + k.key))}<small class="muted" style="display:block">${esc(t('gm.sides', sideName(k, k.bride), sideName(k, k.groom)))}</small></span><span class="v">${pts(k.points)} / ${pts(k.max)}</span></div>`).join('')}</div>
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
  // The next event in the sky from now, whichever year is shown below.
  const y0 = new Date().getFullYear(), at = Date.now() / 1000;
  const nx = (await skyEvents(y0).catch(() => [])).find(e => e.at > at) || (await skyEvents(y0 + 1).catch(() => [])).find(e => e.at > at);
  if (tab !== 'sky') return;
  // The planets stay where they are; only their dots twinkle, over a faint field of stars drifting slowly behind.
  let html = `<div class="card starfield"><p class="label">${esc(t('sk.now'))}</p><div class="planets">${now.grahas.map((g, i) => `<div><span class="gdot" style="color:${GCOL[g.graha]};--i:${i}">●</span> <b>${esc(name('grahas', g.graha))}${g.retrograde ? ' ᴿ' : ''}</b><div class="small muted">${esc(name('rashis', g.sign))} ${Math.floor(g.degrees)}° · ${esc(name('nakshatras', g.nakshatra))}</div></div>`).join('')}</div></div>
    ${nx ? `<div class="card rise skynext" ${nx.kind.endsWith('eclipse') ? 'data-next style="cursor:pointer"' : ''}><p class="label">${esc(t('tb.next'))}</p><b class="serif" style="font-size:20px">${esc(skyTitle(nx))}</b>
      <div class="small muted">${esc(dLabel(nx.at))} · ${esc(clock(nx.at))}</div></div>` : ''}
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
  $('#main').querySelector('[data-next]')?.addEventListener('click', () => eclipseSheet(nx));
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
// ---------------------------------------------------------------- games
// As on iOS (GamesView): the board games of festival nights, in games.js. The hero counts down to Vaikuntha
// Ekadashi, whose night the virtue board is played, from the tradition's own festival list.
let vigilFor = null;
function viewGames() {
  const d = today(), key = `${S.culture}|${S.home?.id}|${d}`;
  if (vigilFor?.key !== key) vigilFor = { key, p: upcoming(d, 400).then(xs => xs.find(x => VIGIL.test(x.f.id)) || null).catch(() => { vigilFor = null; return null; }) };
  const c = CULTURES.find(x => x.id === S.culture);
  showGames($('#main'), { t, tIn, esc, lang: lang(), culture: S.culture, packLang: pack.language, cultureName: c ? (S.native ? c.native : c.en) : '', loading, active: () => tab === 'games',
    vigil: () => (vigilFor?.p || Promise.resolve(null)).then(v => {
      if (!v) return null;
      const n = daysBetween(d, v.date);
      return { name: fname(v.f), today: n === 0, when: n === 1 ? t('day.tomorrow') : t('day.inDays', n), date: greg(v.date) };
    }) });
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
        <div class="small" style="opacity:.9">${esc(prayerLine(tp))}</div>${verse(tp)}<div class="small" style="opacity:.8">${esc(t('pr.weekday', name('weekdays', day), t('deity.' + tp.deity)))}</div></button>` : ''}
      ${favs.length ? `<p class="label">${esc(t('pr.favorites'))}</p>${favs.map(prayerRow).join('')}` : ''}
      <p class="label">${esc(t('pr.deities'))}</p><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">${book.deities.map(d => { const hs = book.prayers.filter(p => p.deity === d), n = hs.length, count = n === 1 ? t('pr.k.hymn') : t('pr.hymns', n);
        // Each deity turns now and then to how many hymns it holds and the first of them.
        return `<button class="turn prdeity" data-pd="${d}"><span class="tfront card"><span style="color:var(--accent);display:block;margin-bottom:6px">${deityIcon(d, 30)}</span><b>${esc(t('deity.' + d))}</b><div class="small muted">${esc(count)}</div></span>${lacquer(hs[0] && { caption: count, fact: prayerTitle(hs[0]), line: t('deity.' + d) }, 'green')}</button>`; }).join('')}</div>`;
  };
  // Today's verse, its first lines, word by word.
  const verse = p => { const ls = (p.text?.[prayerScript()] || p.text?.deva)?.[0]?.split('\n').slice(0, 2) || []; let i = 0;
    return ls.length ? `<div class="prverse">${ls.map(l => l.split(/\s+/).filter(Boolean).map(w => `<span class="ww" style="--i:${i++}">${esc(w)}</span>`).join(' ')).join('<br>')}</div>` : ''; };
  $('#main').innerHTML = `<h2 class="serif" style="margin-bottom:4px">${esc(t('py.title'))}</h2><p class="muted" style="margin-top:0">${esc(t('pr.intro'))}</p>
    <input type="search" id="prq" class="field" placeholder="${esc(t('pr.search'))}" value="${esc(PRV.q)}" style="width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;margin-bottom:12px"><div id="prlist">${list()}</div>`;
  $('#prq').oninput = e => { PRV.q = e.target.value; $('#prlist').innerHTML = list(); wire(); };
  wire();
  startTurns($('#main'), '.prdeity');
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
// Now, two clocks side by side for the chosen place: the ordinary clock of twelve hours (its second hand sweeping,
// or stepping when less motion is asked for), and the dial of sixty, its hand at the time since this morning's
// sunrise there, with the count in the tradition's units beneath and a mark where the sun sets. Both run live
// until the screen is left.
let otTick = null, otRaf = 0;
const stopOldTime = () => { clearInterval(otTick); cancelAnimationFrame(otRaf); otTick = null; otRaf = 0; };
async function ghatiDial(el, place) {
  stopOldTime();
  const now = Date.now() / 1000, td = today(place.tz);
  let p = await day(td, place).catch(() => null);
  if (p && now < p.sunrise) p = await day(addDays(td, -1), place).catch(() => null);
  if (!p || !el.isConnected) return;
  const u = timeUnitNames(), unit = OT.proportional ? (p.nextSunrise - p.sunrise) / 60 : 1440, C = 110, R = 88;
  const deg = x => Math.min(360, Math.max(0, (x - p.sunrise) / unit * 6)), at = (a, r) => [C + Math.sin(a * Math.PI / 180) * r, C - Math.cos(a * Math.PI / 180) * r];
  const ticks = Array.from({ length: 60 }, (_, i) => { const [x0, y0] = at(i * 6, R + (i % 5 ? 4 : 0)), [x1, y1] = at(i * 6, R + 10);
    return `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="${i % 5 ? '' : 'five'}"/>`; }).join('');
  const nums = [0, 15, 30, 45].map(n => { const [x, y] = at(n * 6, R - 14); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}">${n}</text>`; }).join('');
  const hours = Array.from({ length: 12 }, (_, i) => { const [x, y] = at(i * 30, R - 14); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}">${i || 12}</text>`; }).join('');
  const [sx, sy] = at(deg(p.sunset), R);
  const clockAt = x => dtf({ hour: 'numeric', minute: '2-digit', ...hourOpts(), timeZone: place.tz }).format(new Date(x * 1000));
  const secF = dtf({ hour: 'numeric', minute: '2-digit', second: '2-digit', ...hourOpts(), timeZone: place.tz });
  el.innerHTML = `<div class="dial"><p class="label">${esc(t('r2.clock'))}</p><svg viewBox="0 0 220 220" aria-hidden="true" class="aclock"><circle cx="${C}" cy="${C}" r="${R}" class="face"/>
        <g class="ticks">${ticks}</g><g class="nums">${hours}</g>
        <line class="hh" x1="${C}" y1="${C + 10}" x2="${C}" y2="${C - 46}"/><line class="mh" x1="${C}" y1="${C + 12}" x2="${C}" y2="${C - 70}"/>
        <line class="sh" x1="${C}" y1="${C + 16}" x2="${C}" y2="${C - R + 4}"/><circle cx="${C}" cy="${C}" r="4.5" class="pin"/></svg>
      <div class="serif dread aread" aria-live="off"></div></div>
    <div class="dial"><p class="label">${esc(u[0])} · ${esc(u[1])}</p><svg viewBox="0 0 220 220" aria-hidden="true"><circle cx="${C}" cy="${C}" r="${R}" class="face"/><circle cx="${C}" cy="${C}" r="${R}" class="done" pathLength="360" transform="rotate(-90 ${C} ${C})"/>
        <g class="ticks">${ticks}</g><g class="nums">${nums}</g><circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="4" class="sunset"><title>${esc(t('sun.sunset'))}</title></circle>
        <g class="hand"><line x1="${C}" y1="${C + 12}" x2="${C}" y2="${C - R + 6}"/><circle cx="${C}" cy="${C}" r="5"/></g></svg>
      <div class="serif dread gbig" aria-live="polite"></div></div>
    <div class="gread"><div class="small muted gline"></div>
      <div class="small muted">↑ ${esc(t('sun.sunrise'))} ${esc(clockAt(p.sunrise))} · <span class="gold">●</span> ${esc(t('sun.sunset'))} ${esc(clockAt(p.sunset))}</div></div>`;
  const hand = el.querySelector('.hand'), done = el.querySelector('.done');
  const hh = el.querySelector('.hh'), mh = el.querySelector('.mh'), sh = el.querySelector('.sh'), aread = el.querySelector('.aread');
  // The place's clock: its offset from UTC, read again each minute (a change of summer time).
  let off = 0, offAt = -1;
  const wall = ms => {
    if (offAt < 0 || ms - offAt > 60000) {
      const q = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: place.tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
        .formatToParts(new Date(ms)).map(x => [x.type, x.value]));
      off = Date.UTC(+q.year, +q.month - 1, +q.day, +q.hour % 24, +q.minute, +q.second) - Math.floor(ms / 1000) * 1000; offAt = ms;
    }
    const d = new Date(ms + off); return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds() + d.getUTCMilliseconds() / 1000 };
  };
  const rot = (l, a) => l.setAttribute('transform', `rotate(${a.toFixed(2)} ${C} ${C})`);
  const live = () => el.isConnected && tab === 'oldtime';
  const hands = (ms, smooth) => {
    const w = wall(ms), sec = smooth ? w.s : Math.floor(w.s), min = w.m + sec / 60;
    rot(sh, sec * 6); rot(mh, min * 6); rot(hh, ((w.h % 12) + min / 60) * 30);
  };
  let lastSec = -1;
  const second = () => {
    if (!live()) return stopOldTime();
    const ms = Date.now(), x = ms / 1000;
    if (x >= p.nextSunrise) return ghatiDial(el, place);
    aread.textContent = secF.format(new Date(ms));
    const r = tradTime(p, x, OT.proportional), a = deg(x);
    hand.style.transform = `rotate(${a.toFixed(2)}deg)`; done.style.strokeDasharray = `${a.toFixed(2)} 360`;
    el.querySelector('.gbig').innerHTML = `${r.n} <small>${esc(u[0])}</small> ${r.v} <small>${esc(u[1])}</small>`;
    el.querySelector('.gline').textContent = t('ot.result', r.n, u[0], r.v, u[1]);
  };
  second(); hands(Date.now(), !still());
  if (still()) { otTick = setInterval(() => { second(); if (live()) hands(Date.now(), false); }, 1000); return; }
  const frame = () => {
    if (!live()) return stopOldTime();
    const ms = Date.now(), s = Math.floor(ms / 1000);
    hands(ms, true);
    if (s !== lastSec) { lastSec = s; second(); }
    if (otRaf) otRaf = requestAnimationFrame(frame);
  };
  otRaf = requestAnimationFrame(frame);
}
async function viewOldTime() {
  const u = timeUnitNames(), place = OT.place || S.home;
  OT.date ||= today(place.tz);
  if (OT.time == null) { const now = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: place.tz }).format(new Date()); OT.time = now; }
  const opts = n => Array.from({ length: 60 }, (_, i) => `<option ${i === n ? 'selected' : ''}>${i}</option>`).join('');
  $('#main').innerHTML = `<h2 class="serif" style="margin-bottom:4px">${esc(t('ot.title'))}</h2><p class="muted" style="margin-top:0">${esc(t('ot.intro', u[0], u[1]))}</p>
    <div class="card ghati clocks" id="otdial"></div>
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
  ghatiDial(m.querySelector('#otdial'), place);
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
  // Each temple rises in its turn; now and then one's head turns to what the list holds of it: its deity, its
  // place, and when it was built or the airport nearest.
  let ri = 0;
  const backOf = x => ({ caption: t('deity.' + x.deity), fact: x.place,
    line: x.built ? t('tm.built', x.built) : x.air?.[0] ? `✈︎ ${x.air[0][0]} (${x.air[0][1]})` : x.rail?.[0] ? `🚆 ${x.rail[0][0]}` : '' });
  const card = x => `<div class="card temple${viewTemples.quiet ? '' : ' rise'}" style="--i:${ri++}"><div class="tmhead turn v" data-k="${esc(x.id)}"><div class="tfront"><h2 class="serif">${deityIcon(x.deity, 20)} ${esc(x.name)}</h2><div class="small muted tmplace"><span>📍 ${esc(x.place)}</span><span>${esc(distText(kmFrom(origin, x)))}</span></div>
    ${x.built ? `<div class="small" style="color:var(--accent);font-weight:700">🕰 ${esc(t('tm.built', x.built))}</div>` : ''}</div>${lacquer(backOf(x), 'green')}</div>
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
  $('#tmq').oninput = e => { tmQuery = e.target.value; clearTimeout(viewTemples.t); viewTemples.t = setTimeout(() => { viewTemples.quiet = true; viewTemples().then(() => { viewTemples.quiet = false; const i = $('#tmq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 250); };
  $('#main').querySelector('[data-tmhome]')?.addEventListener('click', () => { tmNear = null; viewTemples(); });
  $('#main').querySelector('[data-tmpick]').onclick = () => placePicker($('#tmpp'), p => { tmNear = p; viewTemples(); });
  startTurns($('#main'), '.tmhead');
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
// One place's row in At home and away: its date, and when the festival is kept there (or its moonrise), on its own clock.
function haRow(cls, label, place, date, w, moon, rel) {
  const at = u => clockIn(u, place.tz);
  return `<div class="harow ${cls}"><div class="hahead"><span class="label">${esc(label)} · ${esc(place.name)}</span>${rel ? `<span class="pill">${esc(rel)}</span>` : ''}</div>
    <div class="hadate">${esc(greg(date))}</div>
    ${w ? `<div class="small">${esc(t('f.keptAt', t('k.' + w.kala)))}</div><div class="hatime">${esc(w.start === w.end ? at(w.start) : `${at(w.start)} – ${at(w.end)}`)}</div>`
      : moon ? `<div class="small">${esc(t('sun.moonrise'))}</div><div class="hatime">${esc(at(moon))}</div>` : ''}</div>`;
}
async function festivalSheet(id, date) {
  const f = pack.festivals.find(x => x.id === id); if (!f) return;
  const handle = await cal(+date.slice(0, 4));
  const [p, w, occ] = await Promise.all([day(date), engine({ op: 'window', handle, id, date }), engine({ op: 'festivals', handle })]);
  const how = occ.find(o => o.id === id && o.date === date)?.how || '';
  // An Ekadashi's parana the next morning; the moonrise for fasts kept until the moon is seen.
  const parana = /ekadas/.test(id) ? await engine({ op: 'parana', handle, date }).catch(() => null) : null;
  const moonFast = /karva|karwa|sankashti|sankatahara|chauth|chandra-darshan|ganesh-chaturthi/.test(id);
  const byMoon = moonFast && p.moonrise && w?.kala !== 'moonrise';
  // The same festival where the user lives now: its own date there, and its times on that calendar.
  const away = awayPlace();
  const there = away ? await (async () => {
    const d = nearestDate((await awayIndex(date, date, away)).get(id), date);
    if (!d) return null;
    const ah = await cal(+d.slice(0, 4), away);
    const [ap, aw] = await Promise.all([day(d, away), engine({ op: 'window', handle: ah, id, date: d }).catch(() => null)]);
    return { date: d, w: aw, moon: moonFast && aw?.kala !== 'moonrise' ? ap.moonrise : null };
  })().catch(() => null) : null;
  const steps = f.content?.howTo ? (f.content.howTo[lang()] ?? f.content.howTo.en ?? []) : [];
  const fo = sheet(`<div style="clear:both"></div>
    <button class="btn soft noprint" data-bm style="float:right;margin-left:8px" aria-pressed="${bookmarked(f.id)}" title="${esc(t(bookmarked(f.id) ? 'r3.unbookmarkFest' : 'r3.bookmarkFest', fname(f)))}">${bookmarked(f.id) ? '★' : '☆'}</button>
    ${f.tier === 'major' ? `<span class="pill">${esc(t('f.major'))}</span>` : ''}${isHoliday(f) ? `<span class="pill">${esc(t('f.holiday'))}</span>` : ''}
    <h1 class="serif" style="margin:6px 0 0">${esc(fname(f))}</h1><div class="muted">${esc(fother(f))}</div>
    <div style="color:var(--accent);font-weight:700;margin-top:6px">${esc(greg(date))}</div>
    <div class="small muted">${esc(cultureDate(p.solar, keptLunar(f, p.lunar)))}</div>
    <p>${esc(text(f.content?.summary))}</p>
    <div class="card hacard"><p class="label">${esc(t('ha.title'))}</p>
      ${haRow('home', t('dual.home'), S.home, date, w, byMoon ? p.moonrise : null)}
      ${!away ? `<div class="haadd noprint"><p class="small muted">${esc(t('ha.addHint'))}</p><button class="btn soft" data-addaway>${AWAY_PIN} ${esc(t('s.addAway'))}</button></div>`
        : there ? haRow('away', t('dual.away'), away, there.date, there.w, there.moon, relation(date, there.date))
        : `<div class="harow away"><div class="hahead"><span class="label">${esc(t('dual.away'))} · ${esc(away.name)}</span></div><div class="small muted">${esc(t('ha.none'))}</div></div>`}</div>
    ${parana ? `<div class="card"><p class="label">${esc(t('v.parana'))}</p><div class="small" style="color:var(--accent);font-weight:700">${esc(greg(addDays(date, 1), { weekday: 'short', day: 'numeric', month: 'short' }))}</div><div style="font-size:20px;font-weight:700">${esc(span(parana))}</div>${parana.dvadashiEnd ? `<div class="small muted">${esc(t('v.dvadashiEnds', clock(parana.dvadashiEnd)))}</div>` : ''}<div class="small muted">${esc(t('v.paranaWhy'))}</div></div>` : ''}
    ${f.content?.traditions ? `<div class="card"><p class="label">${esc(t('f.traditions'))}</p><p>${esc(text(f.content.traditions))}</p></div>` : ''}
    ${f.local?.[S.home?.country] ? `<div class="card"><p class="label">${esc(t('f.whereYouLive'))}</p><p>${esc((lang() !== 'en' && f.localNative?.[S.home.country]) || f.local[S.home.country])}</p></div>` : ''}
    ${f.content?.story ? `<div class="card"><p class="label">${esc(t('f.story'))}</p><p>${esc(text(f.content.story))}</p></div>` : ''}
    ${steps.length ? `<div class="card"><p class="label">${esc(t('f.howTo'))}</p><ol>${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>` : ''}
    ${f.variations?.length ? `<div class="card"><p class="label">${esc(t('f.notes'))}</p>${(lang() !== 'en' && f.variationsNative?.length ? f.variationsNative : f.variations).map(v => `<p class="small">${esc(v)}</p>`).join('')}</div>` : ''}
    ${how ? `<div class="card"><p class="label">${esc(t('f.dateHow'))}</p><p class="small muted">${esc(explainHow(how))}</p></div>` : ''}
    ${VIGIL.test(id) ? `<button class="btn block noprint" data-game style="margin-bottom:8px">${esc(t('gm.festivalLink', t(gameKey('pp', S.culture))))}</button>` : ''}
    <button class="btn soft block noprint" data-fics style="margin-bottom:8px">🗓 ${esc(t('r3w.festToCal', fname(f)))}</button>
    <p class="small muted noprint">${esc(t('r3w.calWhy'))}</p>
    <button class="btn soft block noprint" onclick="window.print()">${SHARE_ICON} ${esc(t('pdf.share'))}</button>`);
  fo.querySelector('[data-fics]').onclick = () => festivalIcs(f, date);
  // Vaikuntha Ekadashi's night: the virtue board, one tap away.
  fo.querySelector('[data-game]')?.addEventListener('click', () => { fo.remove(); GM.screen = 'pp'; tab = 'games'; render(); scrollTo(0, 0); });
  // Once chosen, the page opens again with both places (and the list behind it gains its away lines).
  fo.querySelector('[data-addaway]')?.addEventListener('click', () => pickAway(() => { fo.remove(); if (tab === 'festivals') render(); festivalSheet(id, date); }));
  fo.querySelector('[data-bm]').onclick = e => { toggleBookmark(f.id); const on = bookmarked(f.id), b = e.currentTarget;
    b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', on); b.title = t(on ? 'r3.unbookmarkFest' : 'r3.bookmarkFest', fname(f)); toast(t(on ? 'r3w.bookmarked' : 'r3w.unbookmarked', fname(f))); };
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
    ${notesOn(d).map(n => `<p><span class="notepin">${PIN}</span> <b>${esc(n.title)}</b> <span class="small muted">${esc(noteWhen(n))}</span></p>`).join('')}
    <button class="btn block" data-view>${esc(t('cal.viewDay'))}</button>`);
  o.querySelector('[data-view]').onclick = () => { o.remove(); dayDate = d; dayPlace = monthPlace; tab = 'today'; render(); };
}
async function viewMonth(turn = 0) {
  const m = monthDate || today().slice(0, 8) + '01';
  // Turning the page keeps the old one (turned away) on screen while the new month is read.
  if (!turn) loading();
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
    // A festival's day turns now and then to its name on gold; a vrat the user keeps, on maroon.
    const vk = c.recurring.find(r => S.vrats.includes(r)), back = top ? lacquer({ fact: fname(top) }, 'gold') : vk ? lacquer({ fact: recName(vk) }, 'maroon') : '';
    // A pin where the user has a note or event of their own.
    const ns = notesOn(c.date), noteAria = ns.length ? ', ' + t('r3.notes') + ': ' + ns.map(n => n.title).join(', ') : '';
    return `<button class="c2 cs-${cs} ${c.date === td ? 'today' : ''}${back ? ' turn' : ''}${emb}" data-day="${c.date}" data-fs="${esc(fs.map(f => f.id).join(','))}" aria-label="${esc(greg(c.date) + ', ' + sub + (fs.length ? ', ' + fs.map(fname).join(', ') : '') + why + noteAria)}"><span class="tfront">
      <span class="top"><b class="num">${+c.date.slice(8)}</b>${moon ? `<i class="moon">${moon}</i>` : ''}${ns.length ? `<i class="notepin">${PIN}</i>` : ''}${top ? `<span class="t td ${top.tier === 'major' ? 'maj' : ''}">${esc(sub)}</span>` : ''}<span class="grow"></span>${band === 0 ? '<i class="mk" title="✦">✦</i>' : band === 1 ? '<i class="mk">✪</i>' : ''}</span>
      ${top ? `<span class="fn ${top.tier === 'major' ? 'maj' : ''}">${esc(fname(top))}</span>` : `<span class="t">${esc(sub)}</span>${cs !== 'minimal' ? `<span class="n">${esc(name('nakshatras', c.nakshatra))}</span>` : ''}`}
      ${cs !== 'minimal' && c.sunrise ? `<span class="sun" aria-hidden="true">↑${esc(hm(c.sunrise))} ↓${esc(hm(c.sunset))}</span>` : ''}</span>${back}</button>`;
  }).join('');
  $('#main').innerHTML = `<div class="dayhead"><div class="nav"><button class="arrow" data-m="-1">‹</button>
      <div><button class="mtitle" data-jump><h1 class="serif" style="font-size:24px;margin:0">${esc(head)}</h1><div class="muted">${esc(dtf({ month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(m)))}</div>${yl ? `<div class="small muted">${esc(yl)}</div>` : ''}</button>
      <select id="calstyle" class="placechip noprint" aria-label="${esc(t('cs.title'))}">${[['festive', 'cs.festive'], ['minimal', 'cs.minimal'], ['classic', 'cs.classic']].map(([v, k]) => `<option value="${v}" ${(S.calStyle || 'festive') === v ? 'selected' : ''}>🎨 ${esc(t(k))}</option>`).join('')}</select>
      ${m !== today().slice(0, 8) + '01' ? `<button class="btn" data-mtoday style="padding:3px 12px;font-size:13px">${esc(t('day.today'))}</button>` : ''}
      <select class="placechip noprint" aria-label="${esc(t('cal.location'))}"><option value="home" ${!monthPlace ? 'selected' : ''}>📍 ${esc(S.home.name)}</option>
        ${monthPlace ? `<option value="other" selected>📍 ${esc(monthPlace.name)}</option>` : ''}<option value="pick">${esc(t('cal.other'))}</option></select></div>
      <button class="arrow" data-m="1">›</button></div></div>
    ${S.pdfWatermark !== false ? `<div class="printmark"><img alt="" src="emblems-print/${(items.find(x => x.f.tier === 'major') || items[0])?.f.card || 'lotus'}.svg"></div>` : ''}
    <div class="grid g2 ${turn ? 'pagein' + (turn < 0 ? ' back' : '') : 'fadein'}">${wd.map(w => `<div class="wd">${esc(w)}</div>`).join('')}${'<div></div>'.repeat(lead)}${grid}</div>
    <div class="small muted calleg">${sp ? `<div><span><b class="mk">✦</b> ${esc(t('cal.ring0'))}</span><span><b class="mk">✪</b> ${esc(t('cal.ring1'))}</span></div>
      <label>👤 <select id="ringfor">${S.people.filter(p => p.kind !== 'remembrance' && p.anchor?.nakshatra).map(p => `<option value="${p.id}" ${p.id === sp.id ? 'selected' : ''}>${esc(t('cal.for', p.name))}</option>`).join('')}</select></label>` : `<div>${esc(t('cal.addStar'))}</div>`}
      <div><span>↑ ↓ ${esc(t('cal.sunLegend'))}</span><span><i class="fd"></i>${esc(t('tab.festivals'))}</span><span>● ${esc(name('tithis', 'purnima'))}</span><span>○ ${esc(name('tithis', 'amavasya'))}</span>${(S.notes || []).length ? `<span><i class="notepin">${PIN}</i> ${esc(t('r3.notes'))}</span>` : ''}</div>
      <button class="linkbtn noprint" data-legend>${esc(t('r3.legendWhat'))}</button></div>
    <div id="calpeople" class="noprint"></div>
    <p class="small muted" style="margin-top:10px;display:none"><span class="dot major"></span> ${esc(t('f.major'))} &nbsp; <span class="dot"></span> ${esc(t('tab.festivals'))} &nbsp; <span class="dot hollow"></span> ${['ekadashi', 'purnima', 'amavasya'].map(k => esc(name('tithis', k))).join(' · ')}</p>
    ${items.length ? `<p class="label" style="margin-top:16px">${esc(t('tab.festivals'))}</p>` : ''}
    ${items.map((x, i) => festRow(x.f, x.date, { i, back: festBack(x.f, x.date), fam: 'gold' })).join('')}
    <div class="noprint" style="display:flex;gap:8px"><button class="btn soft" style="flex:1" onclick="window.print()">${SHARE_ICON} ${esc(t('pdf.month'))}</button><button class="btn soft" style="flex:1" data-year>${SHARE_ICON} ${esc(t('pdf.year'))}</button></div>`;
  $('#main').querySelector('[data-year]').onclick = () => printYear(y, place);
  // A new month turns the grid like a wall calendar's page: up and away, the next one down into place.
  $('#main').querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    const d = parse(m), k = +b.dataset.m; d.setUTCMonth(d.getUTCMonth() + k, 1); monthDate = ymd(d);
    if (still() || S.tileFlip === false) return viewMonth();
    $('#main .g2').classList.add(k > 0 ? 'pageout' : 'pageout-back'); setTimeout(() => tab === 'calendar' && viewMonth(k), 300);
  });
  $('#main').querySelectorAll('[data-day]').forEach(c => { c.onclick = () => daySummary(c.dataset.day, place);
    // Long press or right-click a day: open it, bookmark its festival, add a note or event.
    onHold(c, (x, y) => dayMenu(c.dataset.day, x, y, c.dataset.fs ? c.dataset.fs.split(',').map(id => pack.festivals.find(f => f.id === id)).filter(Boolean) : [], place)); });
  $('#main').querySelector('[data-legend]').onclick = legendGuide;
  calPeople($('#calpeople'), sp);
  $('#main').querySelector('#calstyle').onchange = e => { S.calStyle = e.target.value; save(); viewMonth(); };
  $('#main').querySelector('#ringfor')?.addEventListener('change', e => { S.starPerson = e.target.value; save(); viewMonth(); });
  $('#main').querySelector('[data-mtoday]')?.addEventListener('click', () => { monthDate = null; viewMonth(); });
  // Tap the title to jump to any month.
  $('#main').querySelector('[data-jump]').onclick = () => {
    const o = sheet(`<h2 class="serif">${esc(t('cal.jump'))}</h2><input type="month" id="mj" value="${m.slice(0, 7)}" style="font-size:18px;padding:8px"><button class="btn block" data-go2 style="margin-top:12px">${esc(t('c.done'))}</button>`);
    o.querySelector('[data-go2]').onclick = () => { const v = o.querySelector('#mj').value; if (v) monthDate = v + '-01'; o.remove(); viewMonth(); };
  };
  $('#main').querySelector('select.placechip:not(#calstyle)').onchange = e => {
    if (e.target.value === 'home') { monthPlace = null; viewMonth(); }
    else if (e.target.value === 'pick') {
      const o = sheet(`<h2 class="serif">${esc(t('cal.other'))}</h2><div id="mp"></div>`, o => placePicker(o.querySelector('#mp'), p => { monthPlace = p; o.remove(); viewMonth(); }));
    }
  };
  wireFestivals();
  // One loop for the screen: a day of the grid or a festival below it, one at a time.
  startTurns($('#main'), '.c2.turn, .frow');
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

// A festival row's lacquered back: its name, and its one-line summary, or else its date and weekday.
const festBack = (f, date) => { const sum = text(f.content?.summary);
  return { caption: fname(f), fact: sum || greg(date, { weekday: 'long', day: 'numeric', month: 'long' }) }; };
// With o (the festivals list), the row rises in at its place and turns now and then to its one line or its date.
// With away ({ place, date }), a quiet second line where the festival falls on another day there.
function festRow(f, date, o, away) {
  const n = daysBetween(today(), date);
  if (o) return `<div class="frow turn v rise" style="--i:${o.i}" data-f="${esc(f.id)}" data-d="${date}">${festRow(f, date, null, o.away).replace(/^<div class="fest ([^"]*)" data-f="[^"]*" data-d="[^"]*">/, '<div class="fest tfront $1">')}${lacquer(o.back, o.fam, true)}</div>`;
  return `<div class="fest ${f.tier === 'major' ? 'major' : ''}" data-f="${esc(f.id)}" data-d="${date}"><div class="bar2"></div>
    <div style="min-width:44px;text-align:center"><b>${+date.slice(8)}</b><div class="small muted">${esc(dtf({ month: 'short', timeZone: 'UTC' }).format(parse(date)))}</div></div>
    <div><b>${esc(fname(f))}</b>${bookmarked(f.id) ? ` <span class="gold" title="${esc(t('r3w.bookmarked', fname(f)))}">★</span>` : ''}<div class="small muted">${esc(fother(f))}</div>${away ? `<div class="small muted faway">${AWAY_PIN}${esc(away.place.name)}${away.date === date ? '' : ` · ${esc(dtf({ day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parse(away.date)))}`} · ${esc(relation(date, away.date))}</div>` : ''}</div>
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
  // Where the user lives now, each festival's date there, read once for the whole list.
  const away = awayPlace(), idx = away ? await awayIndex(today(), addDays(today(), 370), away).catch(() => null) : null;
  const awayOf = x => { const d = idx && nearestDate(idx.get(x.f.id), x.date); return d ? { place: away, date: d } : null; };
  // Quiet chips: the chosen kind filled, the rest outlined.
  let html = `<div class="chips noprint fkinds" style="margin-bottom:12px">${[['major', 'f.major'], ['regional', 'ff.regional'], ['fasting', 'ff.fasting'], ['jayanti', 'ff.jayanti'], ['all', 'f.all']].map(([k, l]) => `<button class="chip ${kind === k ? 'on' : ''}" data-fk="${k}">${esc(t(l))}</button>`).join('')}</div>`;
  let month = '', i = 0;
  for (const x of list) {
    const mm = x.date.slice(0, 7);
    if (mm !== month) { month = mm; html += `<p class="label" style="margin-top:14px">${esc(dtf({ month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(x.date)))}</p>`; }
    html += x.obs ? `<div class="list-row obs rise" style="--i:${i++}"><span style="color:var(--gold)">☾</span><span class="grow">${esc(recName(x.obs))}</span><span class="small muted">${esc(dtf({ day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parse(x.date)))}</span></div>`
      : festRow(x.f, x.date, { i: i++, back: festBack(x.f, x.date), fam: KINDS.fasting(x.f) ? 'maroon' : 'gold', away: awayOf(x) });
  }
  $('#main').innerHTML = html + `<button class="btn soft block noprint" onclick="window.print()">${SHARE_ICON} ${esc(t('pdf.share'))}</button>`;
  $('#main').querySelectorAll('[data-fk]').forEach(b => b.onclick = () => { fKind = b.dataset.fk; viewFestivals(); });
  wireFestivals();
  startTurns($('#main'), '.frow');
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
  const rows = [], nexts = [], td = today();
  // The day by the calendar on the front; now and then the row turns to the day by the panchangam, where it is known.
  const calDay = s => { if (!s) return ''; const y = +td.slice(0, 4), md = s.slice(4); let d = ymd(parse(y + md)); if (d < td) d = ymd(parse(y + 1 + md)); return d; };
  const when = s => { const n = daysBetween(td, s); return n === 0 ? t('day.today') : n === 1 ? t('day.tomorrow') : t('day.inDays', n); };
  for (const p of S.people) {
    let next = '';
    for (const y of [+td.slice(0, 4), +td.slice(0, 4) + 1]) {
      const ds = p.anchor ? await engine({ op: 'personalDates', handle: await cal(y), anchor: p.anchor, kind: p.kind || 'birthday', basis: p.basis }).catch(() => []) : [];
      next = ds.find(d => d >= td); if (next) break;
    }
    nexts.push(next || '');
    const c = calDay(p.date), back = next && lacquer({ caption: t('mw.panDay'), fact: greg(next, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }), line: when(next) }, 'clay', true);
    rows.push(`<div class="list-row prow" data-p="${p.id}"><div class="grow${back ? ' turn v' : ''}"><div class="tfront"><b>${esc(t(p.kind === 'remembrance' ? 'pp.remembranceOf' : 'pp.birthdayOf', p.name))}</b> <span class="small" style="color:var(--accent);font-weight:700">${p.relation ? esc(t('rel.' + p.relation)) : ''}</span>
      <div class="small muted">${esc(natalLine(p.anchor))}</div>${c ? `<div class="small" style="color:var(--accent)">${esc(t('mw.calDay', greg(c)))}</div>` : next ? `<div class="small" style="color:var(--accent)">${esc(greg(next))}</div>` : ''}</div>${back || ''}</div>
      <button class="btn soft" data-edit="${p.id}">${esc(t('c.edit'))}</button></div>`);
  }
  // The next to come glows softly.
  const soon = nexts.filter(Boolean).sort()[0], soonId = soon && S.people[nexts.indexOf(soon)].id;
  adoptFamilyless();
  const groups = [...S.families.map(f => [f.name, S.people.map((p, i) => [p, rows[i]]).filter(([p]) => p.family === f.id)])].filter(([, l]) => l.length);
  $('#main').innerHTML = `<p class="label">${esc(t('pp.title'))}</p><p class="small muted">${esc(t('pp.intro'))}</p>
    ${groups.map(([n, l]) => `<div class="card"><p class="label">${esc(n)}</p>${l.map(([, r]) => r).join('')}</div>`).join('')}
    <button class="btn block" data-add>＋ ${esc(t('pp.add'))}</button>`;
  $('#main').querySelector('[data-add]').onclick = () => personEditor(null);
  $('#main').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => personEditor(S.people.find(p => p.id === b.dataset.edit)));
  if (soonId) $('#main').querySelector(`.prow[data-p="${soonId}"]`)?.classList.add('soon');
  startTurns($('#main'), '.prow .turn');
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
    let html, a = null; try { a = await anchorFor(d, minutes, place); html = anchorCard(a); } catch { html = `<p class="small" style="color:var(--accent);font-weight:700">⚠ ${esc(t('pp.failed'))}</p><button class="btn soft" id="bretry">${esc(t('c.retry'))}</button>`; }
    if (mine !== seq) return;
    if (!a || still() || STAR_KEYS.indexOf(a.nakshatra) < 0) { $('#bres').innerHTML = html; $('#bretry')?.addEventListener('click', run); return; }
    // The moon goes twice round the twenty-seven stars and settles on this one; then the card turns to the reading.
    await starRing($('#bres'), STAR_KEYS.indexOf(a.nakshatra), () => mine === seq);
    if (mine === seq) turnSwap($('#bres'), html);
  };
  $('#bd').onchange = run; $('#bt').onchange = run;
  placePicker($('#bpick'), p => { place = p; $('#bplace').textContent = p.name; $('#bpick').querySelector('.results').innerHTML = ''; run(); });
}

// A ring of the twenty-seven nakshatras, Ashwini at the top; the moon travels it (two turns and on to the star) in 2.5 s.
function starRing(el, k, alive) {
  const C = 120, R = 96, TAU = Math.PI * 2, at = (a, r = R) => [C + Math.sin(a) * r, C - Math.cos(a) * r];
  const dots = STAR_KEYS.map((_, i) => { const [x, y] = at(i / 27 * TAU); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === k ? 4 : 3}" class="${i === k ? 'goal' : ''}"/>`; }).join('');
  el.innerHTML = `<div class="starring"><svg viewBox="0 0 240 240" aria-hidden="true"><circle cx="${C}" cy="${C}" r="${R}" class="track"/>${dots}<circle r="11" class="smoon" cx="${C}" cy="${C - R}"/></svg>
    <div class="srname serif"></div></div>`;
  const moon = el.querySelector('.smoon'), goal = (k / 27 + 2) * TAU, t0 = performance.now(), ms = 2500;
  return new Promise(res => {
    const step = now => {
      if (!alive() || !moon.isConnected) return res();
      const f = Math.min(1, (now - t0) / ms), e = 1 - (1 - f) ** 3, [x, y] = at(goal * e);
      moon.setAttribute('cx', x.toFixed(1)); moon.setAttribute('cy', y.toFixed(1));
      if (f < 1) return requestAnimationFrame(step);
      el.querySelector('.goal')?.classList.add('lit'); el.querySelector('.srname').textContent = name('nakshatras', STAR_KEYS[k]);
      setTimeout(res, 600);
    };
    requestAnimationFrame(step);
  });
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
    const from = addDays(today(), 1); const d = parse(from); d.setUTCMonth(d.getUTCMonth() + 12); const to = ymd(d);
    flapBoard($('#mres'), from, to);
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
    const from = addDays(today(), 1); const d = parse(from); d.setUTCMonth(d.getUTCMonth() + M.months); const to = ymd(d);
    flapBoard($('#mres'), from, to);
    const chosen = couple ? [bride, groom] : [births.find(p => p.id === M.profile)].filter(Boolean);
    const people = chosen.map(p => ({ nakshatra: p.anchor.nakshatra, moonSign: p.anchor.moonSign, lagna: p.anchor.lagna }));
    let out = [];
    for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) out = out.concat(await engine({ op: 'muhurtham', handle: await cal(y), event: M.event, from, to, people }));
    M.results = { list: out.sort((a, b) => b.score - a.score || (a.date < b.date ? -1 : 1)), chosen };
    renderResults();
  };
  if (M.results) renderResults();
}
// While the finder searches: a split-flap board rolling through the dates it is looking at.
function flapBoard(el, from, to) {
  el.innerHTML = `<div class="flapboard" role="status"><span></span><span></span><span></span></div><p class="small muted" style="text-align:center">${esc(t('pp.reading'))}</p>`;
  const fl = [...el.querySelectorAll('.flapboard span')], n = Math.max(1, daysBetween(from, to)), slow = still();
  let i = 0;
  const show = () => {
    if (!fl[0].isConnected) return clearInterval(h);
    const d = parse(addDays(from, i)); i = (i + 1 + Math.floor(n / 90)) % n;
    [String(d.getUTCDate()), dtf({ month: 'short', timeZone: 'UTC' }).format(d), String(d.getUTCFullYear())].forEach((v, j) => {
      if (fl[j].textContent === v) return;
      fl[j].textContent = v;
      if (!slow) { fl[j].classList.remove('flip'); void fl[j].offsetWidth; fl[j].classList.add('flip'); }
    });
  };
  const h = setInterval(show, slow ? 700 : 140); show();
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
    ${shown.map((m, i) => `${monthHead(m, i)}<div class="card rise" style="--i:${i}"><div style="display:flex;justify-content:space-between"><b>${esc(greg(m.date))}</b><span class="small muted">${esc(t('day.inDays', daysBetween(today(), m.date)))}</span></div>
      <div style="color:var(--accent);font-weight:700">${m.windows.map(span).map(esc).join(' · ')}</div>
      ${m.lagnas.length ? `<div class="small">${esc(t('m.lagnas', m.lagnas.map(l => `${name('rashis', l.lagna)} ${clock(l.start)}–${clock(l.end)}`).join(' · ')))}</div>` : ''}
      <div class="small">${esc(t('m.why', m.nakshatras.map(n => name('nakshatras', n)).join(', '), m.tithis.map(tithiName).join(', ')))}</div>
      ${[m.abhijit && t('m.abhijit'), m.tithis.some(x => x <= 15) && t('m.waxing')].filter(Boolean).map((x, j) => `<span class="pill pop" style="--d:${Math.min(i, 12) * 55 + 380 + j * 160}ms">${esc(x)}</span>`).join('')}
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
  pookalam: 2, sun: 2, lakshmi: 2, pooram: 2, kite: 2, holi: 3, krishna: 3, newyear: 3, water: 3, boat: 3, tree: 3, tulsi: 3, naga: 3 , kali: 0, remembrance: 0, stars: 0, floatinglamps: 0, om: 0, trishul: 0, mountain: 0, bell: 0, shesha: 0, gate: 0, cow: 1, bull: 1, dhak: 1, gudi: 1, dahihandi: 1, tilak: 1, bathukamma: 1, aarti: 1, durga: 2, sugarcane: 2, harvest: 2, mango: 2, vishu: 2, ugadi: 2, pohela: 2, puthandu: 2, elephant: 2, footprints: 2, kalash: 2, toran: 2, rangoli: 2, conch: 3, swan: 3, jagannath: 3, ganga: 3, coconut: 3, peacock: 3, kolam: 3, alpana: 3, nepalinewyear: 3, bodhi: 3, garland: 3, mehndi: 3, crow: 3, dog: 3, govardhan: 3, books: 3, tools: 3, axe: 3})[m] ?? 4;
// The Greetings home, as on iOS (GreetingsHome): the next festival's card ready to make, the coming
// festivals on a shelf, the family's birthdays and star birthdays, life's occasions, and a style from every region.
// English for the redesign's text until the build carries every language (the keys are shared with iOS and Android).
const GX_EN = {
  "gx.title": "Greetings", "gx.tagline": "Every festival · every occasion · every region", "gx.next": "In %@", "gx.make": "Make the card",
  "gx.coming": "Coming festivals", "gx.family": "For your family", "gx.occasions": "Occasions", "gx.styles": "Styles from every region",
  "gx.card": "Card", "gx.style": "Style", "gx.moving": "Moving", "gx.still": "Still", "gx.send": "Send", "gx.save": "Save", "gx.bday": "%@'s birthday",
  "gx.starBday": "%@'s star birthday", "occ.birthday.name": "Birthday", "occ.birthday.title": "Happy Birthday",
  "occ.birthday.line": "Wishing you a joyful year ahead, with good health and happiness.", "occ.birthday.lineTo": "Happy birthday, %@!",
  "occ.starBirthday.name": "Star birthday", "occ.starBirthday.title": "Happy Star Birthday",
  "occ.starBirthday.line": "On your birth star, wishing you blessings, good health and joy.", "occ.starBirthday.lineTo": "Happy star birthday, %@!",
  "occ.anniversary.name": "Anniversary", "occ.anniversary.title": "Happy Anniversary",
  "occ.anniversary.line": "Wishing you both many more years of love and togetherness.", "occ.anniversary.lineTo": "Happy anniversary, %@!",
  "occ.grihaPravesh.name": "Griha pravesh", "occ.grihaPravesh.title": "Griha Pravesh",
  "occ.grihaPravesh.line": "Wishing you joy, peace and togetherness in your new home.", "occ.newBaby.name": "New baby",
  "occ.newBaby.title": "Welcome, Little One", "occ.newBaby.line": "Congratulations on the little one! Wishing the baby a lifetime of love.",
  "occ.naming.name": "Naming day", "occ.naming.title": "Naming Ceremony", "occ.naming.line": "Blessings to the little one on this naming day.",
  "occ.upanayanam.name": "Upanayanam", "occ.upanayanam.title": "Upanayanam", "occ.upanayanam.line": "Warm wishes on the sacred thread ceremony.",
  "occ.firstLessons.name": "First lessons", "occ.firstLessons.title": "First Lessons",
  "occ.firstLessons.line": "Wishing a bright start to a lifetime of learning.", "occ.sixtieth.name": "Sixtieth",
  "occ.sixtieth.title": "Happy Sixtieth", "occ.sixtieth.line": "Sixty years well lived: wishing you joy and good health in the years ahead.",
  "occ.sixtieth.lineTo": "Happy sixtieth, %@!", "occ.wedding.name": "Wedding", "occ.wedding.title": "Wedding Wishes",
  "occ.wedding.line": "Wishing you both a lifetime of love, understanding and joy.", "occ.thanks.name": "Thank you", "occ.thanks.title": "Thank You",
  "occ.thanks.line": "With heartfelt thanks for your kindness.", "occ.memory.name": "In memory", "occ.memory.title": "In Loving Memory",
  "occ.memory.line": "Remembering with love.", "st.kasavu.name": "Kasavu", "st.kasavu.region": "Kerala", "st.kolam.name": "Kolam",
  "st.kolam.region": "Tamil Nadu", "st.alpana.name": "Alpana", "st.alpana.region": "Bengal", "st.pattachitra.name": "Pattachitra",
  "st.pattachitra.region": "Odisha", "st.warli.name": "Warli", "st.warli.region": "Maharashtra", "st.bandhani.name": "Bandhani",
  "st.bandhani.region": "Gujarat", "st.dhaka.name": "Dhaka", "st.dhaka.region": "Nepal", "st.madhubani.name": "Madhubani",
  "st.madhubani.region": "Bihar", "st.kalamkari.name": "Kalamkari", "st.kalamkari.region": "Andhra and Telangana", "st.mysuru.name": "Mysuru gold",
  "st.mysuru.region": "Karnataka", "st.phulkari.name": "Phulkari", "st.phulkari.region": "Punjab and the north", "st.island.name": "Island",
  "st.island.region": "The diaspora"
};
// The text in a language, the English above when the strings do not have it yet.
const gxIn = (L, key, ...args) => STR[key] ? tIn(L, key, ...args) : GX_EN[key] ? GX_EN[key].replace('%@', String(args[0] ?? '')) : key;
const gx = (key, ...args) => gxIn(lang(), key, ...args);
// Life's occasions: [id, motif, palette, design, icon, tint, soft]. "memory" is a quiet remembrance: still, never "happy".
const GX_ICON = {
  diya: 'M3 13c0 3.5 4 6 9 6s9-2.5 9-6H3z M12 3.5c1.6 2 2.2 3.5 2.2 4.8a2.2 2.2 0 0 1-4.4 0c0-1.3.6-2.8 2.2-4.8z',
  cake: 'M4 21h16 M5 21v-7h14v7 M5 16c2 1.5 4 1.5 7 0s5-1.5 7 0 M12 14V9 M12 6.5c.8-1 .8-2 0-3-.8 1-.8 2 0 3z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  rings: 'M9 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M15 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
  house: 'M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-6h4v6',
  baby: 'M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M6 21c0-4 2.7-7 6-7s6 3 6 7 M9 7h.01 M15 7h.01',
  thread: 'M4 20c4-4 12-12 16-16 M7 20c3-3 10-10 13-13 M4 17c3-3 10-10 13-13',
  book: 'M4 5c3-1 5-1 8 1 3-2 5-2 8-1v14c-3-1-5-1-8 1-3-2-5-2-8-1z M12 6v14',
  sixty: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 3 M3 12h2 M19 12h2',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  thanks: 'M7 11V20 M7 11l4-7a2 2 0 0 1 3 2l-1 4h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7 M3 11h4v9H3z',
  leaf: 'M5 19c0-8 6-14 14-14 0 8-6 14-14 14z M5 19l8-8',
};
const OCC_LIST = [['birthday', 'garland', 1, 'classic', 'cake', '#B5523B', '#FBEDE7'], ['starBirthday', 'stars', 0, 'classic', 'star', '#8F6510', '#FBF1DC'],
  ['anniversary', 'rings', 4, 'heritage', 'rings', '#7A2335', '#F7E6E9'], ['grihaPravesh', 'kalash', 2, 'classic', 'house', '#0F5A4A', '#E6F1EC'],
  ['newBaby', 'cradle', 1, 'botanical', 'baby', '#B5523B', '#FBEDE7'], ['naming', 'tulsi', 3, 'botanical', 'leaf', '#0F5A4A', '#E6F1EC'],
  ['upanayanam', 'thread', 2, 'arch', 'thread', '#8F6510', '#FBF1DC'], ['firstLessons', 'books', 3, 'classic', 'book', '#2E4A6B', '#E4EAF2'],
  ['sixtieth', 'kalash', 2, 'heritage', 'sixty', '#8F6510', '#FBF1DC'], ['wedding', 'mandap', 4, 'mandala', 'heart', '#7A2335', '#F7E6E9'],
  ['thanks', 'lotus', 3, 'botanical', 'thanks', '#2E4A6B', '#E4EAF2'], ['memory', 'remembrance', 5, 'classic', 'diya', '#5E534B', '#F3EDE3']];
const OCC = Object.fromEntries(OCC_LIST.map(([id, motif, p, design, icon, tint, soft]) => [id, { id, motif, p, design, icon, tint, soft }]));
const OCC_LINE_TO = ['birthday', 'starBirthday', 'anniversary', 'sixtieth'];
// New motifs (rings, cradle, thread, mandap) are being drawn: until a card's art is there, the garland stands in.
const MOTIF_MISSING = new Set();
let motifsProbed = null;
const probeMotifs = () => motifsProbed ||= Promise.all(['rings', 'cradle', 'thread', 'mandap'].map(m =>
  fetch(`cards/${m}.svg`, { method: 'HEAD' }).then(r => { if (!r.ok) MOTIF_MISSING.add(m); }).catch(() => MOTIF_MISSING.add(m))));
const motifOf = f => { const m = f.card || 'lotus'; return MOTIF_MISSING.has(m) ? 'garland' : m; };
// An occasion as a card the maker can draw: its motif, no festival names; the words come from occ.<id>.*.
const occFest = id => ({ id: 'occ-' + id, occ: id, card: OCC[id].motif, names: {}, content: {} });
// The regional style from the user's tradition, else the card's own design.
const REGION_STYLE = { malayalam: 'kasavu', tamil: 'kolam', 'sri-lankan-tamil': 'kolam', 'malaysian-tamil': 'kolam', 'south-african-tamil': 'kolam', bengali: 'alpana', odia: 'pattachitra',
  marathi: 'warli', gujarati: 'bandhani', nepali: 'dhaka', telugu: 'kalamkari', kannada: 'mysuru', caribbean: 'island', fijian: 'island', mauritian: 'island' };
function suggestedStyle(f) {
  const own = f.occ ? OCC[f.occ].design : suggestedDesign(f.card);
  if (f.occ === 'memory') return own;
  if (S.culture === 'north-indian') {
    const en = (f.names?.en || '').toLowerCase();
    if (/lohri|baisakhi|vaisakhi/.test(f.id) || /lohri|baisakhi|vaisakhi/.test(en)) return 'phulkari';
    if (/chhath/.test(f.id)) return 'madhubani';
    return own;
  }
  return REGION_STYLE[S.culture] || own;
}

async function viewGreetings() {
  loading();
  const d = today();
  await probeMotifs();
  const list = (await upcoming(d, 180)).filter(x => x.f.tier !== 'minor');
  // The family's next birthday or star birthday within sixty days, one row each.
  const fam = [];
  const nextCal = s => { if (!s || s.length < 10) return ''; const y = +d.slice(0, 4); let x = `${y}${s.slice(4, 10)}`; if (x < d) x = `${y + 1}${s.slice(4, 10)}`; return x; };
  for (const p of S.people) {
    if (p.kind === 'remembrance') continue;
    const evs = [];
    const b = nextCal(p.date);
    if (b && daysBetween(d, b) <= 60) evs.push({ kind: 'birthday', date: b });
    if (p.anchor) for (const y of [+d.slice(0, 4), +d.slice(0, 4) + 1]) {
      const ds = await engine({ op: 'personalDates', handle: await cal(y), anchor: p.anchor, kind: 'birthday', basis: p.basis }).catch(() => []);
      const n = ds.find(s => s >= d && s <= addDays(d, 60)); if (n) { evs.push({ kind: 'starBirthday', date: n }); break; }
    }
    evs.sort((a, b) => a.date < b.date ? -1 : 1);
    if (evs[0]) fam.push({ p, ...evs[0] });
  }
  fam.sort((a, b) => a.date < b.date ? -1 : 1);
  if (tab !== 'greetings') return;
  const when = s => { const n = daysBetween(d, s); return n === 0 ? t('day.today') : n === 1 ? t('day.tomorrow') : t('day.inDays', n); };
  const hero = list[0], rest = list.slice(1, 16);
  const thumb = (f, cls) => { const m = motifOf(f), p = cardPalette(m); return `<span class="${cls}" style="${cardBg(m, p)};color:${PALETTES[p][2]}"><i style="${cardArt(m, p)}"></i><b>${esc(fname(f))}</b></span>`; };
  const native = f => { const n = f.names[pack.language]; return n && n !== fname(f) ? n : ''; };
  const heroHtml = hero ? (() => { const m = motifOf(hero.f), P = PALETTES[cardPalette(m)];
    return `<button class="gx-hero rise" data-gh style="background:linear-gradient(160deg,${P[1]},${P[0]});color:${P[2]}">
      ${thumb(hero.f, 'gx-float')}
      <span class="gx-herotext"><span class="gx-when" style="color:${P[3]}">${esc(when(hero.date))}</span><span class="serif gx-heroname">${esc(fname(hero.f))}</span>
      ${native(hero.f) ? `<span class="gx-heronat">${esc(native(hero.f))}</span>` : ''}<span class="gx-make" style="background:${P[3]};color:${P[0]}">${esc(gx('gx.make'))}</span></span></button>`; })() : '';
  const short = s => greg(s, { weekday: 'long', day: 'numeric', month: 'long' });
  const famRow = (x, i) => { const o = OCC[x.kind], star = x.kind === 'starBirthday' && x.p.anchor?.nakshatra ? name('nakshatras', x.p.anchor.nakshatra) + ' · ' : '';
    return `<div class="gx-fam rise" style="--i:${i + 2}"><span class="gx-av" style="background:${o.soft};color:${o.tint}">${esc((x.p.name || '?').trim().charAt(0).toUpperCase())}</span>
      <span class="grow"><b class="serif">${esc(gx(x.kind === 'birthday' ? 'gx.bday' : 'gx.starBday', x.p.name))}</b><span class="small muted">${esc(star + short(x.date))} · ${esc(when(x.date))}</span></span>
      <button class="gx-cardbtn" data-gf="${i}" style="background:${o.tint}">${esc(gx('gx.card'))}</button></div>`; };
  const styleTile = (id, i) => { const m = hero ? motifOf(hero.f) : 'lotus';
    return `<button class="gx-sty rise" data-gs="${id}" style="--i:${i}">${styleThumb(id, m, 'gx-stythumb')}<b>${esc(gx(`st.${id}.name`))}</b><span class="small muted">${esc(gx(`st.${id}.region`))}</span></button>`; };
  $('#main').innerHTML = `<div class="gx">
    <div class="gx-head"><span class="small muted">${esc(gx('gx.tagline'))}</span><h2 class="serif">${esc(gx('gx.title'))}</h2></div>
    ${heroHtml}
    ${rest.length ? `<section><h3 class="serif gx-h">${esc(gx('gx.coming'))}</h3><div class="gx-shelf">${rest.map((x, i) => `<button class="gx-fest rise" data-gc="${i}" style="--i:${i}">${thumb(x.f, 'gx-thumb')}<span class="small muted">${esc(when(x.date))}</span></button>`).join('')}</div></section>` : ''}
    ${fam.length ? `<section><h3 class="serif gx-h">${esc(gx('gx.family'))}</h3>${fam.map(famRow).join('')}</section>` : ''}
    <section><h3 class="serif gx-h">${esc(gx('gx.occasions'))}</h3><div class="gx-occ">${OCC_LIST.map(([id], i) => { const o = OCC[id];
      return `<button class="gx-o rise" data-go="${id}" style="--i:${i}"><span class="gx-oi" style="background:${o.soft};color:${o.tint}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${GX_ICON[o.icon]}"/></svg></span><span>${esc(gx(`occ.${id}.name`))}</span></button>`; }).join('')}</div></section>
    <section><h3 class="serif gx-h">${esc(gx('gx.styles'))}</h3><div class="gx-shelf">${REGIONAL.map(styleTile).join('')}</div></section></div>`;
  const m = $('#main');
  m.querySelector('[data-gh]')?.addEventListener('click', () => cardMaker(hero.f, hero.date));
  m.querySelectorAll('[data-gc]').forEach(b => b.onclick = () => cardMaker(rest[+b.dataset.gc].f, rest[+b.dataset.gc].date));
  m.querySelectorAll('[data-gf]').forEach(b => b.onclick = () => { const x = fam[+b.dataset.gf];
    // A birthday that is the sixtieth gets the sixtieth's card.
    const sixty = x.kind === 'birthday' && x.p.date && +x.date.slice(0, 4) - +x.p.date.slice(0, 4) === 60;
    cardMaker(occFest(sixty ? 'sixtieth' : x.kind), x.date, { to: x.p.name }); });
  m.querySelectorAll('[data-go]').forEach(b => b.onclick = () => cardMaker(occFest(b.dataset.go), null));
  m.querySelectorAll('[data-gs]').forEach(b => b.onclick = () => hero ? cardMaker(hero.f, hero.date, { style: b.dataset.gs }) : cardMaker(occFest('thanks'), null, { style: b.dataset.gs }));
}
// The twelve regional styles, as on iOS (RegionalCardStyles): each drawn in code on a 200 x 250 card, its folk
// art's patterns, borders and colours; the card's motif in the middle tinted to the style's ink, then the words.
// art: [x, y, size] of the motif; box: [left, top, right, bottom] the words stand in; mark: [right, baseline] of
// the Eka signature; mo: the motion's light and accent.
const REGIONAL = ['kasavu', 'kolam', 'alpana', 'pattachitra', 'warli', 'bandhani', 'dhaka', 'madhubani', 'kalamkari', 'mysuru', 'phulkari', 'island'];
const RS = {
  kasavu: { bg: '#F8F1E0', edge: '#C9A243', ink: '#6B4A12', accent: '#9A7424', tint: ['#8C5A12', '#C9A243'], art: [100, 70, 82], box: [18, 120, 182, 196], mark: [14, 240], mo: ['#C9A243', '#E9A23B'] },
  kolam: { bg: '#9C3D22', edge: '#FFF6E8', ink: '#FFF6E8', accent: '#F2C94C', tint: ['#FFF6E8', '#F2C94C'], art: [100, 74, 50], box: [16, 132, 184, 224], mark: [14, 246], mo: ['#FFF6E8', '#F2C94C'] },
  alpana: { bg: '#B3172B', edge: '#FFFFFF', ink: '#FFFFFF', accent: '#FFD9A0', tint: ['#FFFFFF', '#FFD9A0'], art: [100, 76, 50], box: [16, 144, 184, 220], mark: [14, 247], mo: ['#FFFFFF', '#FFD9A0'] },
  pattachitra: { bg: '#E2AE4C', edge: '#1E1A16', ink: '#1E1A16', accent: '#A3261B', tint: ['#1E1A16', '#A3261B'], art: [100, 76, 76], box: [28, 126, 172, 222], mark: [28, 228], mo: ['#FFF3D6', '#A3261B'] },
  warli: { bg: '#7A4A2A', edge: '#FFF3E2', ink: '#FFF3E2', accent: '#F2C94C', tint: ['#FFF3E2', '#F2C94C'], art: [100, 76, 52], box: [16, 146, 184, 232], mark: [14, 243], mo: ['#FFF3E2', '#F2C94C'] },
  bandhani: { bg: '#A3195B', edge: '#F2C94C', ink: '#FFE7F1', accent: '#F2C94C', tint: ['#FFE7F1', '#F2C94C'], art: [100, 72, 54], box: [36, 108, 164, 198], mark: [14, 246], mo: ['#FFE7F1', '#F2C94C'] },
  dhaka: { bg: '#8E1B1B', edge: '#1E1A16', ink: '#1E1A16', accent: '#8E1B1B', tint: ['#8E1B1B', '#1E1A16'], art: [100, 82, 56], box: [28, 116, 172, 194], mark: [30, 196], mo: ['#F6EEDF', '#8E1B1B'] },
  madhubani: { bg: '#FBF1DC', edge: '#C0392B', ink: '#1E1A16', accent: '#C0392B', tint: ['#1E1A16', '#1E1A16'], art: [100, 70, 44], box: [22, 114, 178, 204], mark: [20, 236], mo: ['#F2A33A', '#C0392B'] },
  kalamkari: { bg: '#F3E6CF', edge: '#8B3A1E', ink: '#2F3E5C', accent: '#8B3A1E', tint: ['#8B3A1E', '#2F3E5C'], art: [100, 80, 54], box: [18, 124, 182, 204], mark: [14, 213], mo: ['#D9A04A', '#8B3A1E'] },
  mysuru: { bg: '#0E3A2C', edge: '#D9B25C', ink: '#F3DFA8', accent: '#D9B25C', tint: ['#F3DFA8', '#D9B25C'], art: [100, 80, 62], box: [26, 128, 174, 218], mark: [24, 228], mo: ['#F3DFA8', '#D9B25C'] },
  phulkari: { bg: '#C2410C', edge: '#F59E0B', ink: '#FEF3C7', accent: '#FCD34D', tint: ['#FEF3C7', '#FCD34D'], art: [100, 78, 56], box: [30, 120, 170, 202], mark: [26, 210], mo: ['#FEF3C7', '#FCD34D'] },
  island: { bg: '#0E7C86', edge: '#FDE68A', ink: '#FFFFFF', accent: '#FDE68A', tint: ['#FFFFFF', '#FDE68A'], art: [100, 82, 62], box: [16, 130, 184, 206], mark: [14, 244], mo: ['#FFFFFF', '#FDE68A'] },
};
const isRegional = d => !!RS[d];
// The style's patterns and borders as an SVG (no words, no motif): used as the card's ground in the maker,
// the shared image and the thumbnails alike.
function styleSVG(id) {
  const R = [];
  const put = s => R.push(s);
  const rep = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');
  let defs = '';
  switch (id) {
    case 'kasavu':
      put(`<rect width="200" height="250" fill="#F8F1E0"/><rect width="200" height="13" fill="#C9A243"/><rect y="15.5" width="200" height="1.4" fill="#C9A243"/>`);
      put(`<rect y="206" width="200" height="13" fill="#C9A243"/><rect y="222.5" width="200" height="4" fill="#C9A243"/>`);
      // The zari's small temple-points along the bands.
      put(`<g fill="#C9A243">${rep(25, i => `<path d="M${i * 8} 17 l4 4 l4 -4z"/><path d="M${i * 8} 206 l4 -4 l4 4z"/>`)}</g>`);
      put(`<circle cx="100" cy="70" r="47" fill="none" stroke="#C9A243" stroke-width=".8" opacity=".55"/>`);
      break;
    case 'kolam': {
      put(`<rect width="200" height="250" fill="#9C3D22"/>`);
      const dots = [];
      for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) if (i || j) dots.push(`<circle cx="${100 + 32 * i}" cy="${74 + 32 * j}" r="2.6"/>`);
      put(`<g fill="#FFF6E8" opacity=".9">${dots.join('')}</g>`);
      put(`<g fill="none" stroke="#FFF6E8" stroke-width="2" stroke-linecap="round" opacity=".9"><path d="M68 42 Q100 8 132 42 Q166 74 132 106 Q100 140 68 106 Q34 74 68 42Z"/>
        <path d="M100 32 C108 37 108 47 100 50 C92 47 92 37 100 32Z M100 116 C92 111 92 101 100 98 C108 101 108 111 100 116Z M58 74 C63 66 73 66 76 74 C73 82 63 82 58 74Z M142 74 C137 82 127 82 124 74 C127 66 137 66 142 74Z"/></g>`);
      // Small dot grids with their loops in the top corners.
      for (const [cx, cy] of [[22, 22], [178, 22]]) put(`<g fill="#FFF6E8" opacity=".75">${rep(9, k => `<circle cx="${cx + 8 * (k % 3 - 1)}" cy="${cy + 8 * (Math.floor(k / 3) - 1)}" r="1.2"/>`)}</g><path d="M${cx - 8} ${cy - 12} Q${cx} ${cy - 20} ${cx + 8} ${cy - 12} Q${cx + 20} ${cy} ${cx + 8} ${cy + 12} Q${cx} ${cy + 20} ${cx - 8} ${cy + 12} Q${cx - 20} ${cy} ${cx - 8} ${cy - 12}Z" fill="none" stroke="#FFF6E8" stroke-width="1" opacity=".6"/>`);
      put(`<path d="M-10 238 Q0 228 10 238 T30 238 T50 238 T70 238 T90 238 T110 238 T130 238 T150 238 T170 238 T190 238 T210 238" fill="none" stroke="#F2C94C" stroke-width="1.5" opacity=".75"/>`);
      break;
    }
    case 'alpana':
      put(`<rect width="200" height="250" fill="#B3172B"/>`);
      put(`<g fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" opacity=".92">
        ${rep(8, i => `<path transform="rotate(${i * 45} 100 76)" d="M100 ${i % 2 ? 26 : 18} C${i % 2 ? 106 : 110} ${i % 2 ? 34 : 30} ${i % 2 ? 106 : 110} 40 100 46 C${i % 2 ? 94 : 90} 40 ${i % 2 ? 94 : 90} ${i % 2 ? 34 : 30} 100 ${i % 2 ? 26 : 18}Z"/>`)}
        <circle cx="100" cy="76" r="30" stroke-width="1" opacity=".6"/><circle cx="100" cy="76" r="64" stroke-dasharray="1 7"/>
        ${rep(8, i => `<path transform="rotate(${i * 45 + 22.5} 100 76)" d="M100 16 c4 -4 9 -2 8 3 c-1 4 -6 4 -6 1"/>`)}
        <path d="M0 10 ${rep(8, () => 'q12.5 14 25 0')}" /><path d="M0 240 ${rep(8, () => 'q12.5 -14 25 0')}"/></g>`);
      put(`<g fill="#FFFFFF" opacity=".7">${rep(16, i => `<circle cx="${6.25 + i * 12.5}" cy="${i % 2 ? 26 : 22}" r="1.1"/><circle cx="${6.25 + i * 12.5}" cy="${i % 2 ? 224 : 228}" r="1.1"/>`)}</g>`);
      break;
    case 'pattachitra':
      defs += `<pattern id="pt" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#E2AE4C"/><rect width="5" height="10" fill="#A3261B"/></pattern>`;
      put(`<rect width="200" height="250" fill="#E2AE4C"/><rect x="7.5" y="7.5" width="185" height="235" rx="6" fill="none" stroke="#1E1A16" stroke-width="3"/>`);
      put(`<path fill="url(#pt)" fill-rule="evenodd" d="M13 13H187V237H13Z M20 20V230H180V20Z"/><rect x="13" y="13" width="174" height="224" fill="none" stroke="#1E1A16" stroke-width="1"/><rect x="20" y="20" width="160" height="210" fill="none" stroke="#1E1A16" stroke-width="1"/>`);
      put(`<g fill="#1E1A16">${[[20, 20], [180, 20], [20, 230], [180, 230]].map(([x, y]) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8"/>`).join('')}</g>`);
      put(`<g fill="none" stroke="#1E1A16" stroke-width="1.2" opacity=".75"><path d="M60 118 h80"/><path d="M70 122 h60" stroke-dasharray="2 3"/></g>`);
      break;
    case 'warli': {
      put(`<rect width="200" height="250" fill="#7A4A2A"/><rect x="6" y="6" width="188" height="238" rx="6" fill="none" stroke="#FFF3E2" stroke-width="1.2" stroke-dasharray="1 5" stroke-linecap="round" opacity=".7"/>`);
      put(`<circle cx="100" cy="76" r="38" fill="none" stroke="#FFF3E2" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"/>`);
      // The tarpa dance: figures in a ring, heads outward, holding hands.
      const fig = `<circle cx="0" cy="-10.5" r="2.8" stroke="none"/><path d="M-4 -7 L4 -7 L0 -0.5Z M0 -0.5 L-4 6 L4 6Z" stroke="none"/><path d="M-4 -6.5 L-8.5 -2 M4 -6.5 L8.5 -2 M-2.5 6 L-3.5 11 M2.5 6 L3.5 11" fill="none"/>`;
      put(`<g fill="#FFF3E2" stroke="#FFF3E2" stroke-width="1.3" stroke-linecap="round">${rep(12, i => `<g transform="rotate(${i * 30} 100 76) translate(100 ${76 - 54})">${fig}</g>`)}</g>`);
      put(`<g fill="#FFF3E2" opacity=".85"><circle cx="26" cy="26" r="6"/>${rep(8, i => `<path transform="rotate(${i * 45} 26 26)" d="M26 15 l1.5 -4 h-3z"/>`)}<path d="M178 20 a9 9 0 1 0 6 16 a7 7 0 1 1 -6 -16z"/></g>`);
      put(`<path d="M20 238 H180" stroke="#FFF3E2" stroke-width="1.4" stroke-dasharray="6 4" opacity=".6"/>`);
      break;
    }
    case 'bandhani':
      defs += `<pattern id="bd" width="14" height="14" patternUnits="userSpaceOnUse"><g fill="#FFE7F1"><circle cx="2.4" cy="3.5" r="1"/><circle cx="4.6" cy="3.5" r="1"/><circle cx="3.5" cy="2.4" r="1"/><circle cx="3.5" cy="4.6" r="1"/></g><circle cx="10.5" cy="10.5" r="1.5" fill="#F2C94C"/></pattern>`;
      put(`<rect width="200" height="250" fill="#A3195B"/><rect width="200" height="250" fill="url(#bd)" opacity=".9"/>`);
      put(`<ellipse cx="100" cy="125" rx="86" ry="106" fill="#A3195B" stroke="#F2C94C" stroke-width="3"/><ellipse cx="100" cy="125" rx="80" ry="100" fill="none" stroke="#FFE7F1" stroke-width="1.1" stroke-dasharray="1 4" stroke-linecap="round"/>`);
      break;
    case 'dhaka':
      defs += `<pattern id="dk" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#8E1B1B"/><path d="M0 0h7v7H0zM7 7h7v7H7z" fill="#1E1A16"/></pattern>`;
      put(`<rect width="200" height="250" fill="url(#dk)"/><rect x="15" y="28" width="170" height="194" rx="10" fill="#F6EEDF"/>`);
      put(`<rect x="18.5" y="31.5" width="163" height="187" rx="8" fill="none" stroke="#8E1B1B" stroke-width="3"/><rect x="23.5" y="36.5" width="153" height="177" rx="6" fill="none" stroke="#1E1A16" stroke-width="1"/>`);
      // The woven bands of small triangles across the panel's head and foot.
      put(`<g>${rep(14, i => `<path d="M${30 + i * 10} 48 l5 -7 l5 7z" fill="${i % 2 ? '#1E1A16' : '#8E1B1B'}"/><path d="M${30 + i * 10} 202 l5 7 l5 -7z" fill="${i % 2 ? '#8E1B1B' : '#1E1A16'}"/>`)}</g>`);
      put(`<g fill="#F6EEDF" opacity=".9">${rep(5, i => `<path d="M${20 + i * 40} 14 l4 -4 l4 4 l-4 4z"/><path d="M${20 + i * 40} 236 l4 -4 l4 4 l-4 4z"/>`)}</g>`);
      break;
    case 'madhubani':
      put(`<rect width="200" height="250" fill="#FBF1DC"/><rect x="7.5" y="7.5" width="185" height="235" rx="8" fill="none" stroke="#1E1A16" stroke-width="2"/><rect x="12.5" y="12.5" width="175" height="225" rx="6" fill="none" stroke="#C0392B" stroke-width="2" stroke-dasharray="4 3"/>`);
      // The sun round the motif, then the paired fish at the foot.
      put(`<circle cx="100" cy="70" r="30" fill="#F2A33A" fill-opacity=".45" stroke="#1E1A16" stroke-width="2"/><g stroke="#1E1A16" stroke-width="2" stroke-linecap="round">${rep(16, i => `<path transform="rotate(${i * 22.5} 100 70)" d="M100 ${i % 2 ? 34 : 31} V${i % 2 ? 28 : 22}"/>`)}</g>`);
      put(`<g stroke="#1E1A16" stroke-width="1.6" stroke-linejoin="round"><path d="M56 222 C66 211 82 211 92 222 C82 233 66 233 56 222Z M56 222 l-8 -7 v14z" fill="#C0392B"/><path d="M144 222 C134 211 118 211 108 222 C118 233 134 233 144 222Z M144 222 l8 -7 v14z" fill="#2E86AB"/>
        <path d="M66 222 h20 M114 222 h20" fill="none" stroke-dasharray="2 3"/><circle cx="87" cy="220" r="1.2" fill="#1E1A16"/><circle cx="113" cy="220" r="1.2" fill="#1E1A16"/></g>`);
      put(`<g fill="#C0392B">${[[22, 22], [178, 22]].map(([x, y]) => `<path d="M${x} ${y - 6} l6 6 l-6 6 l-6 -6z"/>`).join('')}</g>`);
      break;
    case 'kalamkari':
      defs += `<pattern id="kk" width="20" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#8B3A1E"/><rect x="10" width="10" height="10" fill="#2F3E5C"/></pattern><pattern id="kk2" width="20" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#2F3E5C"/><rect x="10" width="10" height="10" fill="#8B3A1E"/></pattern>`;
      put(`<rect width="200" height="250" fill="#F3E6CF"/><rect width="200" height="30" fill="url(#kk)"/><rect y="33" width="200" height="1.4" fill="#8B3A1E"/><rect y="222" width="200" height="28" fill="url(#kk2)"/><rect y="218.6" width="200" height="1.4" fill="#8B3A1E"/>`);
      put(`<g fill="#F3E6CF">${rep(10, i => `<circle cx="${10 + i * 20}" cy="30" r="2.2"/><circle cx="${10 + i * 20}" cy="222" r="2.2"/>`)}</g>`);
      // Pen-drawn neem and mango leaves on a vine either side of the motif.
      for (const s of [1, -1]) {
        const x = v => 100 + s * v;
        put(`<g fill="none" stroke="#8B3A1E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M${x(36)} 116 C${x(44)} 96 ${x(42)} 70 ${x(52)} 48"/>
          <path d="M${x(40)} 100 C${x(58)} 98 ${x(66)} 86 ${x(64)} 76 C${x(52)} 78 ${x(42)} 88 ${x(40)} 100Z" fill="#4F7A3A"/>
          <path d="M${x(45)} 70 C${x(60)} 62 ${x(70)} 50 ${x(66)} 40 C${x(54)} 44 ${x(46)} 56 ${x(45)} 70Z" fill="#D9A04A"/>
          <path d="M${x(43)} 108 C${x(52)} 112 ${x(58)} 112 ${x(62)} 108" /><circle cx="${x(52)}" cy="46" r="3" fill="#8B3A1E"/>
          <path d="M${x(48)} 92 L${x(58)} 84 M${x(50)} 62 L${x(60)} 52" stroke-width="1"/></g>`);
      }
      break;
    case 'mysuru':
      defs += `<radialGradient id="my" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#1E5A44"/><stop offset="1" stop-color="#0E3A2C"/></radialGradient>`;
      put(`<rect width="200" height="250" fill="url(#my)"/>`);
      put(`<path d="M10 240 V80 C10 40 50 14 100 10 C150 14 190 40 190 80 V240 Z" fill="none" stroke="#D9B25C" stroke-width="2.2"/><path d="M16 234 V82 C16 46 54 22 100 17 C146 22 184 46 184 82 V234 Z" fill="none" stroke="#D9B25C" stroke-width="1" opacity=".5"/>`);
      put(`<g fill="#D9B25C"><circle cx="100" cy="6" r="3"/><path d="M96 10 h8 l-4 5z"/><rect x="5" y="78" width="10" height="4" rx="1"/><rect x="185" y="78" width="10" height="4" rx="1"/><rect x="5" y="236" width="10" height="4" rx="1"/><rect x="185" y="236" width="10" height="4" rx="1"/></g>`);
      put(`<g fill="#D9B25C" opacity=".7">${rep(9, i => { const a = Math.PI * (0.15 + 0.7 * i / 8), r = 74; return `<circle cx="${(100 - Math.cos(a) * r * 1.05).toFixed(1)}" cy="${(88 - Math.sin(a) * r).toFixed(1)}" r="1.3"/>`; })}</g>`);
      break;
    case 'phulkari':
      defs += `<pattern id="pk" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="#C2410C"/><path d="M9 1 L17 9 L9 17 L1 9Z" fill="#F59E0B"/><path d="M9 5 L13 9 L9 13 L5 9Z" fill="#FCD34D"/><path d="M9 7.5 L10.5 9 L9 10.5 L7.5 9Z" fill="#C2410C"/></pattern>`;
      put(`<rect width="200" height="250" fill="url(#pk)"/><rect x="19" y="34" width="162" height="182" rx="10" fill="#7C2D12"/><rect x="23.5" y="38.5" width="153" height="173" rx="7" fill="none" stroke="#FCD34D" stroke-width="1" stroke-dasharray="2 2"/>`);
      break;
    case 'island':
      defs += `<linearGradient id="is" x1="0" y1="0" x2=".18" y2="1"><stop offset="0" stop-color="#0E7C86"/><stop offset="1" stop-color="#0B4F6C"/></linearGradient>`;
      put(`<rect width="200" height="250" fill="url(#is)"/>`);
      put(`<g fill="none" stroke="#FFFFFF" stroke-opacity=".35" stroke-width="1.6"><path d="M0 214 Q25 204 50 214 T100 214 T150 214 T200 214"/><path d="M0 228 Q25 218 50 228 T100 228 T150 228 T200 228"/><path d="M0 242 Q25 232 50 242 T100 242 T150 242 T200 242" stroke-opacity=".2"/></g>`);
      put(`<g fill="#F472B6" opacity=".92">${rep(5, i => `<ellipse transform="rotate(${i * 72} 34 36)" cx="34" cy="24" rx="8" ry="12"/>`)}</g><g stroke="#FDE68A" stroke-width="1.2" stroke-linecap="round"><path d="M34 36 L46 50"/></g><circle cx="34" cy="36" r="3.2" fill="#FDE68A"/><circle cx="46" cy="50" r="1.6" fill="#FDE68A"/>`);
      put(`<g fill="none" stroke="#FFFFFF" stroke-opacity=".3" stroke-width="1.2" stroke-linecap="round"><path d="M186 4 C176 18 172 30 170 44 M186 4 C190 16 194 22 200 26 M186 4 C178 8 168 10 160 8"/></g>`);
      break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250" width="400" height="500">${defs ? `<defs>${defs}</defs>` : ''}${R.join('')}</svg>`;
}
const styleURLs = {};
const styleURL = id => styleURLs[id] ||= 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(styleSVG(id));
const styleImgs = {};
async function styleImage(id) {
  if (styleImgs[id]) return styleImgs[id];
  const img = new Image(); img.src = styleURL(id); await img.decode().catch(() => {});
  return styleImgs[id] = img;
}
// A small card in a style: its ground, and the motif in the middle in the style's ink.
const emblemMask = m => `-webkit-mask:url(emblems/${m}.svg) center/contain no-repeat;mask:url(emblems/${m}.svg) center/contain no-repeat`;
function styleThumb(id, m, cls) {
  const R = RS[id], [x, y, s] = R.art;
  return `<span class="${cls}"><img src="${styleURL(id)}" alt=""><i style="left:${(x - s / 2) / 2}%;top:${(y - s / 2) / 2.5}%;width:${s / 2}%;height:${s / 2.5}%;background:linear-gradient(${R.tint[0]},${R.tint[1]});${emblemMask(m)}"></i></span>`;
}
// The words on a card, in the card's language: festival or occasion, addressed or not.
function cardWords(f, date, st) {
  const L = st.lang || lang(), N = pack?.language || 'en', o = f.occ && OCC[f.occ];
  const nameIn = x => (x === 'en' && f.localNames?.[S.home?.country]) || (f.names[x] ?? f.names.en);
  const titleIn = x => o ? gxIn(x, `occ.${o.id}.title`) : nameIn(x);
  const title = titleIn(L), otherL = L === 'en' ? N : 'en', other = otherL !== L ? titleIn(otherL) : '';
  const named = !!(o && st.to && OCC_LINE_TO.includes(o.id));
  const line = o ? (named ? gxIn(L, `occ.${o.id}.lineTo`, st.to) : gxIn(L, `occ.${o.id}.line`))
    : (f.content?.greeting?.[L] ?? f.content?.greeting?.en ?? f.content?.summary?.[L] ?? f.content?.summary?.en ?? '');
  return { L, title, sub: other && other !== title ? other : '', line, occ: !!o,
    dear: st.to && !named ? tIn(L, 'card.dear', st.to) : '', from: st.from ? tIn(L, 'card.with', st.from) : '',
    kicker: o ? '' : tIn(L, 'card.happy'), tag: o ? '' : tIn(L, 'card.tag.' + cardTheme(f.card)),
    dateText: date ? dtf({ day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }, L).format(parse(date)) : '' };
}
// A regional card drawn on a canvas (the maker's preview and the shared image are the same drawing).
async function drawRegional(g, W, H, id, f, date, st, line) {
  const R = RS[id], u = W / 200, w = cardWords(f, date, st);
  g.drawImage(await styleImage(id), 0, 0, W, H);
  const [ax, ay, as] = R.art, em = await tintedEmblem(motifOf(f), R.tint[0], R.tint[1]);
  g.drawImage(em, (ax - as / 2) * u, (ay - as / 2) * u, as * u, as * u);
  const [x0, y0, x1, y1] = R.box, cx = (x0 + x1) / 2 * u, maxW = (x1 - x0) * u;
  const serif = z => `600 ${z}px Georgia, "Noto Serif", serif`, ital = z => `italic ${z}px Georgia, "Noto Serif", serif`;
  const sub = /[A-Za-z]/.test(w.sub) ? w.sub.toUpperCase() : w.sub;
  // Every word is drawn: the message and then the title are set smaller until the block fits the box.
  let tz = 20 * u, lz = 8 * u;
  const lines = (s, font) => { g.font = font; return s ? cardLines(g, s, maxW) : []; };
  const plan = () => {
    const items = [];
    if (w.dear) items.push({ s: [w.dear], font: ital(7.5 * u), z: 7.5 * u, color: R.ink, gap: 3 * u });
    if (w.kicker) items.push({ s: [w.kicker.toUpperCase()], font: `600 ${6 * u}px Georgia, serif`, z: 6 * u, color: R.accent, gap: 3 * u, track: 1.6 * u });
    items.push({ s: lines(w.title, serif(tz)).slice(0, 3), font: serif(tz), z: tz, color: R.ink, gap: 3 * u, lh: 1.12 });
    if (sub) items.push({ s: lines(sub, `600 ${6.5 * u}px Georgia, serif`).slice(0, 2), font: `600 ${6.5 * u}px Georgia, serif`, z: 6.5 * u, color: R.accent, gap: 5 * u, track: 1.2 * u });
    if (line) items.push({ s: lines(line, ital(lz)), font: ital(lz), z: lz, color: R.ink, gap: 4 * u, lh: 1.35 });
    if (w.from) items.push({ s: [w.from], font: `600 ${7.5 * u}px Georgia, serif`, z: 7.5 * u, color: R.accent, gap: 3 * u });
    if (w.dateText) items.push({ s: [w.dateText], font: `${5.8 * u}px Georgia, serif`, z: 5.8 * u, color: R.ink, gap: 0, alpha: .7 });
    const h = items.reduce((a, it) => a + it.s.length * it.z * (it.lh || 1.2) + it.gap, 0);
    return { items, h };
  };
  let P = plan();
  while (P.h > (y1 - y0) * u && lz > 5 * u) { lz -= .25 * u; P = plan(); }
  while (P.h > (y1 - y0) * u && tz > 11 * u) { tz -= .5 * u; P = plan(); }
  let y = y0 * u + Math.max(0, ((y1 - y0) * u - P.h) / 2);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  for (const it of P.items) {
    g.font = it.font; g.fillStyle = it.color; g.globalAlpha = it.alpha ?? 1;
    // Tracking only for Latin capitals: spaced out, an Indic script's letters fall apart.
    if ('letterSpacing' in g) g.letterSpacing = `${it.track && !/[^\x00-\x7F]/.test(it.s.join('')) ? it.track : 0}px`;
    for (const l of it.s) { y += it.z * (it.lh || 1.2); g.fillText(l, cx, y - it.z * (it.lh ? (it.lh - 1) / 2 + .2 : .2)); }
    y += it.gap; g.globalAlpha = 1;
  }
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}
const cardBg = (m, p) => `background:linear-gradient(${PALETTES[p][0]},${PALETTES[p][1]})`;
const cardArt = (m, p) => `background:${PALETTES[p][4]};-webkit-mask:url(cards/${m || 'lotus'}.svg) center/100% 100%;mask:url(cards/${m || 'lotus'}.svg) center/100% 100%;opacity:.85`;
// Movement over a card, as on iOS (CardMotion.swift): each loops every four seconds.
const MOTIONS = ['still', 'glow', 'petals', 'sparkle', 'rays', 'fireworks'];
const suggestedMotion = m => ({ diya: 'glow', lakshmi: 'glow', shiva: 'glow', bonfire: 'glow', tulsi: 'glow', pookalam: 'petals', holi: 'petals', swing: 'petals', krishna: 'petals', lotus: 'petals', pooram: 'petals',
  sun: 'rays', pongal: 'rays', kite: 'rays', newyear: 'rays', chariot: 'rays' , remembrance: 'still', aarti: 'glow', floatinglamps: 'glow', ganga: 'glow', stars: 'glow', rangoli: 'petals', kolam: 'petals', alpana: 'petals', mehndi: 'petals', garland: 'petals', bathukamma: 'petals', peacock: 'petals', harvest: 'rays', sugarcane: 'rays', vishu: 'rays', ugadi: 'rays', pohela: 'rays', puthandu: 'rays', nepalinewyear: 'rays', gudi: 'rays', durga: 'sparkle', kali: 'sparkle', tilak: 'sparkle', dhak: 'sparkle', dahihandi: 'sparkle'})[m] || 'sparkle';
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
  navratri: 'mandala', holi: 'mandala', krishna: 'mandala', swing: 'mandala', rakhi: 'mandala', ganesha: 'arch', shiva: 'arch', vishnu: 'arch', rama: 'arch', hanuman: 'arch', murugan: 'arch', ayyappa: 'arch', naga: 'arch', chariot: 'arch', pooram: 'arch' , floatinglamps: 'lanterns', aarti: 'lanterns', stars: 'lanterns', remembrance: 'lanterns', mango: 'botanical', sugarcane: 'botanical', harvest: 'botanical', garland: 'botanical', bodhi: 'botanical', coconut: 'botanical', swan: 'botanical', ganga: 'botanical', kolam: 'mandala', rangoli: 'mandala', alpana: 'mandala', mehndi: 'mandala', durga: 'mandala', peacock: 'mandala', bathukamma: 'mandala', dhak: 'mandala', kali: 'arch', trishul: 'arch', om: 'arch', bell: 'arch', shesha: 'arch', gate: 'arch', jagannath: 'arch', conch: 'arch', kalash: 'arch', toran: 'arch', footprints: 'arch', elephant: 'arch', mountain: 'arch', books: 'arch'})[m] || 'heritage';
const cardTheme = m => ({ diya: 'light', lakshmi: 'light', shiva: 'light', bonfire: 'light', moon: 'light', vishnu: 'light', pongal: 'harvest', sun: 'harvest', kite: 'harvest', pookalam: 'harvest', tree: 'harvest', boat: 'harvest', water: 'harvest', holi: 'colour', newyear: 'newyear', rakhi: 'bond' , floatinglamps: 'light', aarti: 'light', sugarcane: 'harvest', harvest: 'harvest', mango: 'harvest', coconut: 'harvest', cow: 'harvest', bull: 'harvest', vishu: 'newyear', ugadi: 'newyear', pohela: 'newyear', puthandu: 'newyear', nepalinewyear: 'newyear', gudi: 'newyear', tilak: 'bond'})[m] || 'devotion';
const DCOL = { light: { paper: ['#F8F1E3', '#F1E5CF'], ink: '#6E1631', gold: '#B68A33', accent: '#8E1E45', dark: false },
  arch: { paper: ['#9C1450', '#5E0C33'], ink: '#F3D58C', gold: '#E2B85C', accent: '#1F6E73', dark: true },
  mandala: { paper: ['#4A1B3D', '#2E0F27'], ink: '#F0CF83', gold: '#DDB15A', accent: '#E0607E', dark: true } };
const tintCache = {};
async function tintedEmblem(m, a, b) {
  const k = m + a + b; if (tintCache[k]) return tintCache[k];
  const img = new Image(); img.src = `emblems/${m}.svg`; const ok = await img.decode().then(() => true, () => false);
  if (!ok && m !== 'garland') return tintCache[k] = await tintedEmblem('garland', a, b);
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
  const wd = cardWords(f, date, st);
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
  if (wd.dear) { g.font = `italic ${13 * u}px Georgia, serif`; g.fillStyle = C.ink; g.fillText(wd.dear, cx, y); y += 20 * u; }
  if (wd.kicker) caps(wd.kicker.toUpperCase(), 11, C.ink, 4); y += 48 * u;
  const maxW = (left ? .56 : .8) * W, script = z => `${z}px "Great Vibes", cursive`;
  // The name on one line if it fits at a fair size, else on two.
  let size = fitFont(wd.title, script, (left ? 44 : 52) * u, 30 * u, maxW, 1);
  if (cardLines(g, wd.title, maxW).length > 1) size = fitFont(wd.title, script, (left ? 40 : 44) * u, 16 * u, maxW, 2);
  const nameLines = cardLines(g, wd.title, maxW);
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
  if (wd.from) { y += 6 * u; g.font = `600 ${13 * u}px Georgia, serif`; g.fillStyle = C.gold; g.fillText(wd.from, cx, y); y += 18 * u; }
  // The emblem, as large as the space above the tagline allows.
  const room = H - (d === 'arch' || d === 'mandala' ? 92 : 84) * u - y, es = Math.min(88 * u, room - 16 * u);
  if (!left && es > 40 * u) { const em = await tintedEmblem(motifOf(f), C.accent, C.gold); g.fillStyle = C.dark ? 'rgba(226,184,92,.12)' : 'rgba(182,138,51,.1)'; g.beginPath(); g.arc(W / 2, y + 8 * u + es / 2, es * .57, 0, TAU); g.fill(); g.drawImage(em, W / 2 - es / 2, y + 8 * u, es, es); }
  y = H - (d === 'arch' || d === 'mandala' ? 66 : 58) * u;
  if (wd.tag) wrap(wd.tag.toUpperCase(), `500 ${9.5 * u}px Georgia, serif`, C.ink, 14 * u, (left ? .5 : .8) * W, 2); else y += 14 * u;
  if (wd.dateText) { g.font = `${9 * u}px Georgia, serif`; g.fillStyle = C.ink; g.globalAlpha = .6; g.fillText(wd.dateText, cx, y); g.globalAlpha = 1; }
}
// The motion's light and accent: the palette's, the design's gold and accent, or the regional style's.
const motionColors = st => { if (isRegional(st.design)) return RS[st.design].mo; if (st.design && st.design !== 'classic') { const C = DCOL[st.design === 'arch' ? 'arch' : st.design === 'mandala' ? 'mandala' : 'light']; return [C.gold, C.accent]; } return [PALETTES[st.p][4], PALETTES[st.p][3]]; };
// A style's swatch for the strip: the classic in its palette, a design in its paper and gold, a regional style drawn.
function styleSwatch(d, f, st) {
  const m = motifOf(f);
  if (d === 'classic') return `<span class="gsw" style="${cardBg(m, st.p)}"><i style="${cardArt(m, st.p)}"></i></span>`;
  if (isRegional(d)) return styleThumb(d, m, 'gsw');
  const C = DCOL[d === 'arch' ? 'arch' : d === 'mandala' ? 'mandala' : 'light'];
  return `<span class="gsw" style="background:linear-gradient(${C.paper[0]},${C.paper[1]});box-shadow:inset 0 0 0 2px ${C.gold}"><i style="left:25%;top:30%;width:50%;height:40%;background:linear-gradient(${C.accent},${C.gold});${emblemMask(m)}"></i></span>`;
}
// The card maker, as on iOS (GreetingCardMaker): the card on top; under it the style strip (the six designs and
// the twelve regional styles; choosing one turns the card over to it), English or the tradition's script, Moving
// or Still, who it is to and from, the message, then Send and Save.
// opt: { to } for a card addressed to someone, { style } to open in a style.
function cardMaker(f, date, opt = {}) {
  const occ = f.occ && OCC[f.occ], memory = f.occ === 'memory', N = pack?.language || 'en';
  const st = { p: occ ? occ.p : cardPalette(f.card), to: opt.to || '', from: '', msg: '', lang: lang(), design: opt.style || suggestedStyle(f), motion: 'still' };
  // The motion a Moving card has: the motif's own, sparkle where its own is still.
  let kind = suggestedMotion(motifOf(f)); if (kind === 'still') kind = 'sparkle';
  st.motion = memory || !(st.design === 'classic' || isRegional(st.design)) ? 'still' : suggestedMotion(motifOf(f));
  const STYLES = [...DESIGNS, ...REGIONAL], styleName = d => isRegional(d) ? gx(`st.${d}.name`) : t('card.d.' + d);
  const head = occ ? gx(`occ.${occ.id}.name`) + (date ? ' · ' + greg(date, { weekday: 'long', day: 'numeric', month: 'long' }) : '') : `${fname(f)} · ${greg(date, { weekday: 'long', day: 'numeric', month: 'long' })}`;
  const o = sheet(`<p class="small muted gx-mhead">${esc(head)}</p><h2 class="serif" style="margin-top:0">${esc(t('gr.card'))}</h2><div id="gcard" class="gcard"></div>
    <p class="label">${esc(gx('gx.style'))}</p><div class="gstrip" id="gstrip">${STYLES.map(d => `<button class="gst" data-de="${d}" aria-label="${esc(styleName(d))}">${styleSwatch(d, f, st)}<span>${esc(styleName(d))}</span></button>`).join('')}</div>
    <div class="gtogs">${N !== 'en' ? `<div class="seg" id="glang"><button data-lg="en">English</button><button data-lg="${N}">${esc(langName(N))}</button></div>` : ''}
      ${memory ? '' : `<div class="seg" id="gmove"><button data-mv="1">${esc(gx('gx.moving'))}</button><button data-mv="0">${esc(gx('gx.still'))}</button></div>`}</div>
    ${memory ? '' : `<div class="chips gkinds" id="gmo">${MOTIONS.filter(m => m !== 'still').map(m => `<button class="chip" data-mo="${m}">${esc(t('card.m.' + m))}</button>`).join('')}</div>`}
    <div id="gpal"><p class="label">${esc(t('card.colour'))}</p><div style="display:flex;gap:8px;flex-wrap:wrap">${PALETTES.map((_, i) => `<button class="cardthumb" data-p="${i}" style="${cardBg(motifOf(f), i)}"><i style="${cardArt(motifOf(f), i)}"></i></button>`).join('')}</div></div>
    <label class="field"><span>${esc(t('card.to'))}</span><input id="gto" maxlength="40"></label>
    <label class="field"><span>${esc(t('card.from'))}</span><input id="gfrom" maxlength="40"></label>
    <label class="field"><span>${esc(t('card.message'))}</span><textarea id="gmsg" maxlength="300" rows="3"></textarea></label>
    ${occ ? '' : `<div class="chips">${['card.wish1', 'card.wish2', 'card.wish3'].map(k => `<button class="chip" data-w="${esc(t(k, fname(f)))}">${esc(t(k, fname(f)))}</button>`).join('')}</div>`}
    <div class="gacts"><button class="btn" id="gshare">${SHARE_ICON} ${esc(gx('gx.send'))}</button><button class="btn soft" id="gsave">${esc(gx('gx.save'))}</button></div>`);
  o.querySelector('#gto').value = st.to;
  const words = () => cardWords(f, date, st);
  // The other language's name, above the title (as the classic card and the designs have always shown it).
  const nativeOf = w => w.L === 'en' ? w.sub : '';
  const line = () => st.msg || words().line;
  const controls = () => {
    o.querySelectorAll('[data-de]').forEach(b => { const on = b.dataset.de === st.design; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    o.querySelector('#gpal').style.display = st.design === 'classic' ? '' : 'none';
    o.querySelectorAll('[data-lg]').forEach(b => b.classList.toggle('on', b.dataset.lg === st.lang));
    o.querySelectorAll('[data-mv]').forEach(b => b.classList.toggle('on', (b.dataset.mv === '1') === (st.motion !== 'still')));
    const mo = o.querySelector('#gmo'); if (mo) mo.style.display = st.motion === 'still' ? 'none' : '';
    o.querySelectorAll('[data-mo]').forEach(b => b.classList.toggle('on', b.dataset.mo === st.motion));
  };
  // The card's face, fully drawn before it is shown.
  const face = async () => {
    const el = document.createElement('div'); el.className = 'gcard-in';
    const w = words(), native = nativeOf(w);
    if (st.design === 'classic') {
      const P = PALETTES[st.p], m = motifOf(f);
      el.style.cssText = `${cardBg(m, st.p)};color:${P[2]}`;
      el.innerHTML = `<i style="${cardArt(m, st.p)}"></i>
        <div class="gtext">${w.dear ? `<div class="gdear">${esc(w.dear)}</div>` : ''}${native ? `<div class="gnat" style="color:${P[3]}">${esc(native)}</div>` : ''}
        <div class="serif gname">${esc(w.title)}</div>${w.dateText ? `<div class="gdate">${esc(w.dateText)}</div>` : ''}
        ${line() ? `<div class="gline">${esc(line())}</div>` : ''}${w.from ? `<div class="gfrom" style="color:${P[3]}">${esc(w.from)}</div>` : ''}</div>
        <canvas class="gmotion" width="640" height="800"></canvas><div class="gbrand"><img src="icon-192.png" alt="">Eka</div>`;
      return el;
    }
    // A designed or regional card: drawn on a canvas, the same drawing as the shared image.
    const cv = document.createElement('canvas'); cv.className = 'gdesign'; cv.width = 640; cv.height = 800;
    if (isRegional(st.design)) await drawRegional(cv.getContext('2d'), 640, 800, st.design, f, date, st, line());
    else await drawDesign(cv.getContext('2d'), 640, 800, st.design, f, date, native, line(), st);
    el.appendChild(cv);
    el.insertAdjacentHTML('beforeend', `<canvas class="gmotion" width="640" height="800"></canvas><div class="gbrand"><img src="icon-192.png" alt="">Eka</div>`);
    if (isRegional(st.design)) { const R = RS[st.design], b = el.querySelector('.gbrand'); b.style.right = `${R.mark[0] * 1.6}px`; b.style.bottom = `${(250 - R.mark[1]) * 1.6 - 3}px`; b.style.color = R.ink; b.style.setProperty('color', R.ink, 'important'); }
    return el;
  };
  // Long words in the classic card set smaller until the whole block stands inside it.
  const fit = el => { const gt = el.querySelector('.gtext'); if (gt) for (let z = 1; z > 0.45 && gt.scrollHeight > gt.clientHeight + 1; z -= 0.04) gt.style.zoom = z; };
  let seq = 0;
  const draw = async turn => {
    const my = ++seq, box = o.querySelector('#gcard'), old = box.firstElementChild;
    controls();
    if (turn && old) {
      // Half a turn out, the new face in; a cross-fade when less motion is asked for.
      const how = still() ? ['fadeout', 'fadein'] : ['tyout', 'tyin'];
      old.classList.add(how[0]);
      const [el] = await Promise.all([face(), new Promise(r => setTimeout(r, 300))]);
      if (my !== seq || !o.isConnected) return;
      box.replaceChildren(el); fit(el); el.classList.add(how[1]); setTimeout(() => el.classList.remove(how[1]), 320);
      return;
    }
    const el = await face();
    if (my !== seq || !o.isConnected) return;
    box.replaceChildren(el); fit(el);
  };
  // The preview's motion, drawn every frame while the card maker is open.
  const t0 = performance.now(), calm = still();
  const tick = ts => {
    if (!o.isConnected) return;
    const cv = o.querySelector('.gmotion');
    if (cv) { const g = cv.getContext('2d'); g.clearRect(0, 0, 640, 800); if (st.motion !== 'still') drawMotion(g, st.motion, calm ? 0 : (ts - t0) / 1000, 640, 800, ...motionColors(st)); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  o.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { st.p = +b.dataset.p; draw(true); o.querySelectorAll('.gst[data-de="classic"] .gsw').forEach(s => s.outerHTML = styleSwatch('classic', f, st)); });
  o.querySelectorAll('[data-mo]').forEach(b => b.onclick = () => { st.motion = kind = b.dataset.mo; controls(); });
  o.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => { st.motion = b.dataset.mv === '1' ? kind : 'still'; controls(); });
  o.querySelectorAll('[data-lg]').forEach(b => b.onclick = () => { if (st.lang === b.dataset.lg) return; st.lang = b.dataset.lg; draw(true); });
  o.querySelectorAll('[data-de]').forEach(b => b.onclick = () => { if (st.design === b.dataset.de) return; st.design = b.dataset.de; draw(true); });
  o.querySelector('#gto').oninput = e => { st.to = e.target.value; draw(); };
  o.querySelector('#gfrom').oninput = e => { st.from = e.target.value; draw(); };
  o.querySelector('#gmsg').oninput = e => { st.msg = e.target.value; draw(); };
  o.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { st.msg = b.dataset.w; o.querySelector('#gmsg').value = st.msg; draw(); });
  // The card as a file: a still image, or a looping GIF when it moves.
  const make = async btn => {
    const label = btn.innerHTML;
    let blob = await cardImage(f, date, st, nativeOf(words()), line()), type = 'image/png', ext = 'png';
    if (st.motion !== 'still') {
      btn.disabled = true; btn.textContent = t('card.making');
      const gif = await cardGif(blob, st).catch(() => null);
      btn.disabled = false; btn.innerHTML = label;
      if (gif) { blob = gif; type = 'image/gif'; ext = 'gif'; }
    }
    return { blob, file: new File([blob], `${f.id}.${ext}`, { type }) };
  };
  const download = (blob, nameF) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nameF; a.click(); };
  o.querySelector('#gshare').onclick = async () => {
    const { blob, file } = await make(o.querySelector('#gshare'));
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch {} }
    download(blob, file.name);
  };
  o.querySelector('#gsave').onclick = async () => { const { blob, file } = await make(o.querySelector('#gsave')); download(blob, file.name); };
  draw();
  // The chosen style in view on the strip.
  requestAnimationFrame(() => o.querySelector('.gst.on')?.scrollIntoView({ block: 'nearest', inline: 'center' }));
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
  const w = cardWords(f, date, st);
  if (isRegional(st.design)) {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const g = c.getContext('2d'), R = RS[st.design], u = 1080 / 200;
    await drawRegional(g, 1080, 1350, st.design, f, date, st, line);
    const logo = new Image(); logo.src = 'icon-192.png'; await logo.decode().catch(() => {});
    // A quiet signature in the bottom corner: the icon and "Eka", clear of the style's border.
    const x = 1080 - R.mark[0] * u, y = R.mark[1] * u;
    g.globalAlpha = .6; if (logo.complete) g.drawImage(logo, x - 74, y - 22, 26, 26);
    g.font = '600 24px Georgia, serif'; g.fillStyle = R.ink; g.textAlign = 'left'; g.fillText('Eka', x - 42, y); g.globalAlpha = 1;
    return new Promise(r => c.toBlob(r, 'image/png'));
  }
  if (st.design && st.design !== 'classic') {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const g = c.getContext('2d');
    await drawDesign(g, 1080, 1350, st.design, f, date, native, line, st);
    const logo = new Image(); logo.src = 'icon-192.png'; await logo.decode().catch(() => {});
    // A quiet signature in the bottom corner: the icon and "Eka", inside the border.
    const C = DCOL[st.design === 'arch' ? 'arch' : st.design === 'mandala' ? 'mandala' : 'light'];
    g.globalAlpha = .55; if (logo.complete) g.drawImage(logo, 1080 - 86 - 74, 1350 - 76 - 24, 26, 26);
    g.font = '600 24px Georgia, serif'; g.fillStyle = C.ink; g.textAlign = 'left'; g.fillText('Eka', 1080 - 86 - 42, 1350 - 80); g.globalAlpha = 1;
    return new Promise(r => c.toBlob(r, 'image/png'));
  }
  const P = PALETTES[st.p], W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, P[0]); grad.addColorStop(1, P[1]);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const img = new Image(); img.src = `cards/${motifOf(f)}.svg`; await img.decode().catch(() => {});
  const art = document.createElement('canvas'); art.width = W; art.height = H; const a = art.getContext('2d');
  if (img.complete && img.naturalWidth) a.drawImage(img, 0, 0, W, H); a.globalCompositeOperation = 'source-in'; a.fillStyle = P[4]; a.fillRect(0, 0, W, H);
  g.globalAlpha = .85; g.drawImage(art, 0, 0); g.globalAlpha = 1; g.textAlign = 'center';
  let y = H * .36;
  const put = (s, font, color, gap) => { g.font = font; g.fillStyle = color; for (const l of cardLines(g, s, W - 220)) { g.fillText(l, W / 2, y); y += gap; } };
  // A long message is set smaller until it fits in seven lines; every word stays.
  const fit = (s, make, from, min, lines) => { let z = from; g.font = make(z); while (z > min && cardLines(g, s, W - 220).length > lines) { z -= 1; g.font = make(z); } return z; };
  if (w.dear) put(w.dear, 'italic 48px Georgia, serif', P[2], 70);
  if (native) { const z = fit(native, z => `bold ${z}px sans-serif`, 80, 40, 2); put(native, `bold ${z}px sans-serif`, P[3], z * 1.25); }
  { const z = fit(w.title, z => `bold ${z}px Georgia, serif`, 76, 40, 2); put(w.title, `bold ${z}px Georgia, serif`, P[2], z * 0.95); }
  if (w.dateText) put(w.dateText, '500 38px sans-serif', P[2], 80); else y += 40;
  if (line) { const z = fit(line, z => `italic ${z}px Georgia, serif`, 40, 22, 7); put(line, `italic ${z}px Georgia, serif`, P[2], z * 1.35); }
  if (w.from) { y += 16; put(w.from, '600 44px Georgia, serif', P[3], 60); }
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
  countUp($('#xres .mscore'), r.score, 300 + r.rows.length * 140, x => Number.isInteger(x) ? String(x) : x.toFixed(1));
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
  // The factors fill in one after another while the total counts up to its score.
  let i = 0;
  const row = x => `<details class="factor fillin" style="--i:${i++}"><summary><span class="${x.matching === true ? 'tick' : 'cross'}">${x.matching === true ? '✓' : x.matching === false ? '✗' : '○'}</span>
      <span class="grow"><b>${esc(x.name)}</b>${x.about ? `<span class="small muted" style="display:block">${esc(x.about)}</span>` : ''}${(x.tags || []).map(g => `<span class="pill">${esc(g)}</span>`).join('')}</span>
      <span class="small" style="font-weight:700;${x.matching === true ? 'color:var(--accent)' : ''}">${esc(x.verdict)}</span></summary>
    ${(x.notes || []).map(n => `<p class="small" style="color:var(--accent)">${esc(n)}</p>`).join('')}
    ${x.sections.map(([h, b]) => `${h ? `<p class="label" style="margin:10px 0 2px">${esc(h)}</p>` : ''}${b ? `<p style="margin:0">${br(b)}</p>` : ''}`).join('')}</details>`;
  return `<div class="card"><div><span class="serif mscore" data-score="${r.score}" style="font-size:48px;font-weight:700;color:var(--accent)">${esc(score)}</span> <b class="muted">${esc(r.outOf)}</b></div>
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
    <div class="card">${ten.map((p, i) => `<div class="list-row fillin" style="--i:${i}"><span class="${p.matching ? 'tick' : 'cross'}">${p.matching === true ? '✓' : p.matching === false ? '✗' : '–'}</span>
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
    <div class="card"><p class="label">${esc(t('s.away'))}</p>${S.away ? `<div><b>${esc(S.away.name)}</b> <span class="small muted">${esc([S.away.region, S.away.country].filter(Boolean).join(', '))}</span></div><button class="btn soft" data-noaway style="margin-top:8px">${esc(t('s.removeAway'))}</button>` : `<p class="small muted">${esc(t('ha.addHint'))}</p>`}<div id="ap" style="margin-top:8px"></div></div>
    <div class="card"><p class="label">${esc(t('s.appearance'))}</p>
      <div class="seg">${['system', 'light', 'dark'].map(m => `<button data-th="${m}" class="${S.theme === m ? 'on' : ''}">${esc(t('s.' + m))}</button>`).join('')}</div>
      <p class="small muted" style="margin-top:10px">${esc(t('th.light'))}</p><div class="chips">${LIGHT.map(id => `<button class="chip ${S.light === id ? 'on' : ''}" data-lt="${id}">${esc(t('th.' + id))}</button>`).join('')}</div>
      <p class="small muted" style="margin-top:10px">${esc(t('th.dark'))}</p><div class="chips">${DARK.map(id => `<button class="chip ${S.dark === id ? 'on' : ''}" data-dk="${id}">${esc(t('th.' + id))}</button>`).join('')}</div></div>
    <div class="card"><label class="list-row"><input type="checkbox" id="vaish" ${S.vaishnava ? 'checked' : ''}><span class="grow"><b>${esc(t('s.vaishnava'))}</b><div class="small muted">${esc(t('s.vaishnavaNote'))}</div></span></label></div>
    <div class="card"><label class="list-row"><input type="checkbox" id="pdfmark" ${S.pdfWatermark !== false ? 'checked' : ''}><span class="grow"><b>${esc(t('pdf.section'))}</b><div class="small muted">${esc(t('pdf.watermarkOn'))}</div></span></label></div>
    <div class="card"><label class="list-row"><input type="checkbox" id="tflip" ${S.tileFlip !== false ? 'checked' : ''}><span class="grow"><b>${esc(t('hm.flip'))}</b><div class="small muted">${esc(t('hm.flipNote'))}</div></span></label>${S.tileFlip !== false ? `<div class="seg" style="margin-top:8px" aria-label="${esc(t('hm.flipEvery'))}">${[3, 5, 10, 20, 30].map(n => `<button data-fe="${n}" class="${(S.tileFlipEvery || 5) === n ? 'on' : ''}">${esc(t('hm.secs', String(n)))}</button>`).join('')}</div>` : ''}</div>
    <div class="card"><p class="label">${esc(t('s.clock'))}</p><div class="seg">${[[0, 's.clockSystem'], [12, 's.clock12'], [24, 's.clock24']].map(([v, k]) => `<button data-ck="${v}" class="${(S.clock || 0) === v ? 'on' : ''}">${esc(t(k))}</button>`).join('')}</div></div>
    <div class="card"><p class="label">${esc(t('ts.title'))}</p><div class="seg">${TEXT_SIZES.map((z, i) => `<button data-tz="${i}" class="${S.textSize === i ? 'on' : ''}" style="font-size:${Math.round(12 * z + (i - 1) * 2)}px">A</button>`).join('')}</div>
      <p class="small muted" style="margin-top:8px">${esc(t('ts.sample'))}</p></div>
    ${backupCard()}
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
  $('#main').querySelector('#tflip').onchange = e => { S.tileFlip = e.target.checked; save(); viewSettings(); };
  $('#main').querySelectorAll('[data-fe]').forEach(b => b.onclick = () => { S.tileFlipEvery = +b.dataset.fe; save(); viewSettings(); });
  $('#main').querySelector('#vaish').onchange = async e => { S.vaishnava = e.target.checked; save(); await loadPack(); await resetCalendars(); render(); };
  $('#main').querySelectorAll('[data-ck]').forEach(b => b.onclick = () => { S.clock = +b.dataset.ck; save(); render(); });
  $('#main').querySelectorAll('[data-tz]').forEach(b => b.onclick = () => { S.textSize = +b.dataset.tz; save(); render(); });
  $('#main').querySelectorAll('[data-lt]').forEach(b => b.onclick = () => { S.light = b.dataset.lt; save(); render(); });
  $('#main').querySelectorAll('[data-dk]').forEach(b => b.onclick = () => { S.dark = b.dataset.dk; save(); render(); });
  placePicker($('#hp'), async p => { S.home = p; save(); await resetCalendars(); tab = 'today'; render(); });
  placePicker($('#ap'), p => { S.away = p; save(); viewSettings(); });
  $('#main').querySelector('[data-noaway]')?.addEventListener('click', () => { delete S.away; save(); viewSettings(); });
  wireBackup($('#main'));
}

// ---------------------------------------------------------------- r3: menus, explainers, notes, calendar files, backup
// A file handed to the browser to save.
function download(file, body, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type })); a.download = file;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
// A short line at the foot of the screen that goes by itself.
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 4200);
}
// A clock time on a date in a time zone, as a moment.
function zonedUnix(date, hhmm, tz) {
  const [y, m, d] = date.split('-').map(Number), [h, mi] = (hhmm || '00:00').split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi) / 1000;
  const off = u => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(u * 1000)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) / 1000 - u; };
  const u = guess - off(guess); return guess - off(u);
}
// A calendar file (.ics) the user's own calendar opens: the web cannot alert once the page is closed, a calendar can.
// Each event: { title, text, date (all day) or start/end (moments), yearly, alarms: ['-PT10M', 'PT8H', ...] }.
function icsFile(label, events) {
  const st = u => new Date(u * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const tx = s => String(s || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Funtopia//Eka Panchang web//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of events) {
    L.push('BEGIN:VEVENT', `UID:${e.uid || crypto.randomUUID()}@eka-panchang`, 'DTSTAMP:' + st(Date.now() / 1000));
    if (e.date) L.push('DTSTART;VALUE=DATE:' + e.date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + addDays(e.date, 1).replace(/-/g, ''));
    else L.push('DTSTART:' + st(e.start), 'DTEND:' + st(Math.max(e.end ?? 0, e.start + 60)));
    L.push('SUMMARY:' + tx(e.title));
    if (e.text) L.push('DESCRIPTION:' + tx(e.text));
    if (e.yearly) L.push('RRULE:FREQ=YEARLY');
    for (const a of e.alarms || []) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + tx(e.title), 'TRIGGER:' + a, 'END:VALARM');
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  const file = (String(label).normalize('NFC').replace(/[\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '-') || 'eka-panchang') + '.ics';
  download(file, L.join('\r\n') + '\r\n', 'text/calendar');
  toast(t('r3w.downloaded', label));
}
// A festival as an all-day event, with a reminder a week ahead and on the morning (as the iOS reminder).
function festivalIcs(f, date) {
  icsFile(fname(f), [{ uid: `${f.id}-${date}`, date, title: fname(f), text: [text(f.content?.summary), t('f.forPlace', S.home.name)].filter(Boolean).join('\n'), alarms: ['-P6DT16H', 'PT8H'] }]);
}

// A long press (touch) or right-click opens a small menu; the click that ends a long press does nothing more.
function onHold(el, fn) {
  let timer = 0, sx = 0, sy = 0, fired = 0;
  const fire = (x, y) => { if (Date.now() - fired < 800) return; fired = Date.now(); fn(x, y); };
  el.addEventListener('contextmenu', e => { e.preventDefault(); fire(e.clientX, e.clientY); });
  const cancel = () => { clearTimeout(timer); timer = 0; };
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; sx = e.clientX; sy = e.clientY; cancel();
    timer = setTimeout(() => { timer = 0; navigator.vibrate?.(10); fire(sx, sy); }, 520); });
  el.addEventListener('pointermove', e => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
  el.addEventListener('pointerup', cancel); el.addEventListener('pointercancel', cancel); el.addEventListener('dragstart', cancel);
  el.addEventListener('click', e => { if (Date.now() - fired < 800) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
}
const mIcon = k => HOME_ICONS[k] ? `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HOME_ICONS[k]}</svg>` : (GUIDE_ICONS[k] ? gIcon(k, 17) : '');
// items: [{ label, icon (a HOME_ICONS or GUIDE_ICONS key), fn }], falsy ones left out.
function popMenu(x, y, items) {
  document.querySelector('.pmenu')?.remove();
  items = items.filter(Boolean); if (!items.length) return;
  const m = document.createElement('div'); m.className = 'pmenu'; m.setAttribute('role', 'menu');
  m.innerHTML = items.map((it, i) => `<button role="menuitem" data-mi="${i}"><span class="pmic">${mIcon(it.icon)}</span><span>${esc(it.label)}</span></button>`).join('');
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
  const close = () => { m.remove(); removeEventListener('pointerdown', out, true); removeEventListener('keydown', key, true); removeEventListener('scroll', close, true); removeEventListener('resize', close); };
  const out = e => { if (!m.contains(e.target)) close(); };
  const key = e => {
    const bs = [...m.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); bs[(i + (e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus(); }
  };
  setTimeout(() => { addEventListener('pointerdown', out, true); addEventListener('keydown', key, true); addEventListener('scroll', close, true); addEventListener('resize', close); }, 0);
  m.querySelectorAll('[data-mi]').forEach(b => b.onclick = () => { close(); items[+b.dataset.mi].fn(); });
  m.querySelector('button').focus({ preventScroll: true });
}

// ---------------------------------------------------------------- "What is this?"
// As on iOS (the guide sheet): the feature's name, its lines each with a small icon, and the footnote.
const GUIDE_ICONS = {
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  ring: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r=".8" fill="currentColor"/><circle cx="4" cy="12" r=".8" fill="currentColor"/><circle cx="4" cy="18" r=".8" fill="currentColor"/>',
  dots: '<circle cx="6" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="3" fill="currentColor" fill-opacity=".45"/><circle cx="18" cy="12" r="3"/>',
  planet: '<circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-20 12 12)"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/>',
  diamond: '<path d="M12 3l6 9-6 9-6-9z"/>',
  turn: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  moon: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  hourglass: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9.5" r="2.3"/><path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5M15 14c3 0 5.5 1.8 5.5 5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.5l2.7 2.7L16.5 9.5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.2"/>',
  temple: '<path d="M12 2.5v2M9.5 8h5l-1-3.5h-3zM8 12h8l-1.5-4h-5zM6 20.5h12V12H6z"/><path d="M10.5 20.5v-4a1.5 1.5 0 0 1 3 0v4M4 20.5h16"/>',
};
const gIcon = (k, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GUIDE_ICONS[k] || GUIDE_ICONS.info}</svg>`;
// Topic: its heading, the tile it belongs to (for the icon) and an icon for each line in turn.
const GUIDES = {
  dial: ['r3.dial', 'dial', 'clock ring list dots planet shield diamond turn'],
  ghati: ['ot.title', 'oldtime', 'sun hourglass hourglass clock list sun book'],
  day: ['dm.title', 'day', 'clock list list planet shield diamond list pin'],
  cal: ['tab.calendar', 'calendar', 'calendar moon star sun check turn'],
  sky: ['sk.title', 'sky', 'planet turn turn moon moon info'],
  match: ['mt.label', 'match', 'heart list list check check info lock'],
  star: ['bs.title', 'birthstar', 'star clock dots calendar star lock'],
  muh: ['tab.muhurtham', 'muhurtham', 'calendar list shield people clock info'],
  vrat: ['vj.title', 'vrats', 'book check star calendar moon lock'],
  pray: ['py.title', 'prayers', 'book sun book list star people'],
  temple: ['tm.title', 'temples', 'temple pin search pin info'],
};
// Lines that speak of the phone or of reminders the web edition does not have, in the web's own words (null: left out).
const GUIDE_WEB = { 'r3.g.match.7': 'r3w.g.private', 'r3.g.star.6': 'r3w.g.private', 'r3.g.vrat.6': 'r3w.g.private', 'r3.g.dial.8': 'r3w.g.dial8', 'r3.g.vrat.4': 'r3w.g.vrat4', 'r3.g.vrat.5': null };
const TAB_GUIDE = { today: 'day', calendar: 'cal', sky: 'sky', match: 'match', birthstar: 'star', muhurtham: 'muh', vrats: 'vrat', prayers: 'pray', temples: 'temple', oldtime: 'ghati' };
const TILE_GUIDE = { dial: 'dial', day: 'day', calendar: 'cal', sky: 'sky', match: 'match', birthstar: 'star', vrats: 'vrat', prayers: 'pray', temples: 'temple', oldtime: 'ghati' };
function explainer(topic) {
  const g = GUIDES[topic]; if (!g) return;
  const icons = g[2].split(' '), u = timeUnitNames(), lines = [];
  for (let i = 1; STR[`r3.g.${topic}.${i}`]; i++) {
    const k = `r3.g.${topic}.${i}`;
    const w = k in GUIDE_WEB ? GUIDE_WEB[k] : k; if (!w) continue;
    lines.push([icons[i - 1] || 'info', t(w, u[0], u[1])]);
  }
  const head = HOME_ICONS[g[1]] ? `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HOME_ICONS[g[1]]}</svg>` : gIcon('info', 22);
  sheet(`<div class="guide"><p class="label" style="margin:0">${esc(t('r3.what'))}</p><h2 class="serif guidehead"><span class="onbic">${head}</span>${esc(t(g[0]))}</h2>
    ${lines.map(([ic, s], i) => `<div class="onbline rise" style="--i:${i}"><span class="onbic">${gIcon(ic)}</span><span>${esc(s)}</span></div>`).join('')}
    <p class="small muted" style="margin-top:14px">${esc(t('r3.g.note'))}</p></div>`);
}
// The "i" in the header, on the screens that have a guide.
function infoButton() {
  let ib = $('#infobtn');
  if (!ib) { ib = document.createElement('button'); ib.id = 'infobtn'; ib.className = 'badge infob'; ib.textContent = 'i'; document.querySelector('.badges')?.appendChild(ib); }
  const topic = S.culture && S.home ? TAB_GUIDE[tab] : null;
  ib.hidden = !topic; ib.setAttribute('aria-label', t('r3.what')); ib.title = t('r3.what');
  ib.onclick = () => explainer(topic);
}

// ---------------------------------------------------------------- Home's tile menus and dragging
function tileMenu(k, x, y, ctx) {
  const go = (tb, after) => async () => { tab = tb; if (tb === 'today') { dayDate = null; dayPlace = null; } if (tb === 'calendar') monthDate = null; await render(); scrollTo(0, 0); after?.(); };
  const guide = TILE_GUIDE[k] && { label: t('r3.what'), icon: 'info', fn: () => explainer(TILE_GUIDE[k]) };
  const f = ctx.fest;
  const items = {
    festivals: [f && { label: t('r3.openFest', fname(f.f)), icon: 'festivals', fn: () => festivalSheet(f.f.id, f.date) },
      f && { label: t('r3.makeCard'), icon: 'greetings', fn: () => cardMaker(f.f, f.date) },
      f && { label: t('r3w.festToCal', fname(f.f)), icon: 'calendar', fn: () => festivalIcs(f.f, f.date) },
      { label: t('r3.allFest'), icon: 'list', fn: go('festivals') }],
    day: [{ label: t('r3.dial'), icon: 'dial', fn: () => openDial(today()) }, { label: t('r3.timings'), icon: 'clock', fn: go('today') }],
    dial: [{ label: t('r3.dial'), icon: 'dial', fn: () => openDial(today()) }, { label: t('r3.timings'), icon: 'clock', fn: go('today') }],
    calendar: [{ label: t('day.today'), icon: 'calendar', fn: go('calendar') }, { label: t('r3w.goDate'), icon: 'search', fn: () => goToDate() }],
    vrats: [{ label: t('r3.yearGlance'), icon: 'vrats', fn: go('vrats', () => $('#main .vy')?.closest('.card')?.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' })) }],
    prayers: [ctx.tp && { label: t('pr.today'), icon: 'prayers', fn: () => { PRV.id = ctx.tp.id; go('prayers')(); } }],
    people: [{ label: t('r3.addPerson'), icon: 'people', fn: go('people', () => personEditor(null)) }],
    games: ['pp', 'pl', 'ap'].map(g => ({ label: t(gameKey(g, S.culture)), icon: 'games', fn: () => { GM.screen = g; go('games')(); } })),
  }[k] || [];
  popMenu(x, y, [...items, guide]);
}
// A date chosen, its month shown and the day's summary open over it.
function goToDate() {
  const o = sheet(`<h2 class="serif">${esc(t('r3w.goDate'))}</h2><input type="date" id="gd" value="${today()}" style="font-size:18px;padding:8px"><button class="btn block" data-go2 style="margin-top:12px">${esc(t('c.done'))}</button>`);
  o.querySelector('[data-go2]').onclick = async () => { const v = o.querySelector('#gd').value; o.remove(); if (!v) return;
    monthDate = v.slice(0, 8) + '01'; monthPlace = null; tab = 'calendar'; await render(); daySummary(v, S.home); };
}
// Drag a tile onto another: it lifts, the one beneath gives way, and the rest slide to their new places.
function wireTileDrag(grid) {
  let dragged = null;
  const clear = () => grid.querySelectorAll('.droptarget').forEach(x => x.classList.remove('droptarget'));
  grid.querySelectorAll('.tile[data-k]').forEach(el => {
    el.ondragstart = e => { dragged = el.dataset.k; holdTurns = true; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragged); } catch {} el.classList.add('lifting'); };
    el.ondragend = () => { el.classList.remove('lifting'); clear(); dragged = null; holdTurns = false; };
    el.ondragenter = e => { if (!dragged || dragged === el.dataset.k) return; e.preventDefault(); clear(); el.classList.add('droptarget'); };
    el.ondragover = e => { if (!dragged) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
    el.ondragleave = e => { if (!el.contains(e.relatedTarget)) el.classList.remove('droptarget'); };
    el.ondrop = e => {
      e.preventDefault(); clear();
      if (!dragged || dragged === el.dataset.k) return;
      const order = [...grid.querySelectorAll('.tile[data-k]')].map(x => x.dataset.k).filter(k => k !== dragged);
      order.splice(order.indexOf(el.dataset.k), 0, dragged);
      S.tileOrder = order; save(); flipReorder(grid, order);
    };
  });
}
// FLIP: where each tile was, where it now is, and a slide from the one to the other.
function flipReorder(grid, order) {
  const els = [...grid.querySelectorAll('.tile[data-k]')], first = new Map(els.map(x => [x, x.getBoundingClientRect()]));
  order.forEach(k => { const x = els.find(e => e.dataset.k === k); if (x) grid.appendChild(x); });
  if (still()) return;
  els.forEach(x => { const a = first.get(x), b = x.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if (dx || dy) x.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.2,.75,.25,1)' }); });
}

// ---------------------------------------------------------------- bookmarks and notes
const bookmarked = id => (S.bookmarks || []).includes(id);
const toggleBookmark = id => { S.bookmarks = bookmarked(id) ? S.bookmarks.filter(x => x !== id) : [...(S.bookmarks || []), id]; save(); };
// The notes on a date: its own, and yearly ones from earlier years on the same day of the month.
const notesOn = date => (S.notes || []).filter(n => n.date === date || (n.yearly && n.date < date && n.date.slice(5) === date.slice(5)));
const PIN = '<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M14.5 2.5l7 7-2 .8-3.6 3.6.6 4.6-1.6 1.6-4-4-5.4 5.4-1.4-1.4 5.4-5.4-4-4 1.6-1.6 4.6.6 3.6-3.6z"/></svg>';
const noteWhen = n => n.allDay !== false || !n.time ? t('r3.allDay') : clock(zonedUnix(n.date, n.time, S.home.tz));
function noteRows(date, onChange) {
  const ns = notesOn(date);
  return ns.length ? `<div class="card"><p class="label">${esc(t('r3.notes'))}</p>${ns.map(n => `<div class="list-row"><span class="notepin">${PIN}</span><div class="grow"><b>${esc(n.title)}</b>${n.yearly ? ' <span class="small muted">↻</span>' : ''}<div class="small muted">${esc(noteWhen(n))}${n.text ? ' · ' + esc(n.text) : ''}</div></div><button class="btn soft" data-note="${n.id}">${esc(t('c.edit'))}</button></div>`).join('')}</div>` : '';
}
function wireNoteRows(root, date, onChange) {
  root.querySelectorAll('[data-note]').forEach(b => b.onclick = () => noteEditor(date, (S.notes || []).find(n => n.id === b.dataset.note), onChange));
}
// As on iOS (the note sheet): a title, a note, all day or a time, every year or once, and a reminder. On the web a
// reminder is a calendar file to open, since a page cannot alert once it is closed.
function noteEditor(date, note, onDone) {
  const n = Object.assign({ id: crypto.randomUUID(), date, title: '', text: '', allDay: true, time: '09:00', yearly: false, remind: 'none' }, note || {});
  const o = sheet(`<h2 class="serif">${esc(t(note ? 'r3.editNote' : 'r3.addNote'))}</h2><div class="muted" style="margin-top:-8px">${esc(greg(n.date))}</div>
    <label class="field"><input type="text" id="nt" placeholder="${esc(t('r3.noteTitle'))}" aria-label="${esc(t('r3.noteTitle'))}" value="${esc(n.title)}"></label>
    <label class="field"><textarea id="nx" rows="3" placeholder="${esc(t('r3.noteText'))}" aria-label="${esc(t('r3.noteText'))}">${esc(n.text)}</textarea></label>
    <label class="list-row"><input type="checkbox" id="nad" ${n.allDay ? 'checked' : ''}><span class="grow">${esc(t('r3.allDay'))}</span></label>
    <label class="list-row" id="ntimerow" ${n.allDay ? 'hidden' : ''}><span class="grow">${esc(t('r3.noteTime'))}</span><input type="time" id="ntm" value="${esc(n.time)}"></label>
    <label class="list-row"><input type="checkbox" id="nyr" ${n.yearly ? 'checked' : ''}><span class="grow">${esc(t('r3.repeatYearly'))}</span></label>
    <label class="list-row"><span class="grow">${esc(t('r3.remind'))}</span><select id="nrm">${[['none', 'r3.remindNone'], ['at', 'r3.remindAt'], ['morning', 'r3.remindMorning'], ['before', 'r3.remindDayBefore']].map(([v, k]) => `<option value="${v}" ${n.remind === v ? 'selected' : ''}>${esc(t(k))}</option>`).join('')}</select></label>
    <p class="small muted" id="nrmnote" ${n.remind === 'none' ? 'hidden' : ''}>${esc(t('r3w.remindWeb'))}</p>
    <p class="small" id="nerr" style="color:var(--accent)"></p>
    <div style="display:flex;gap:8px"><button class="btn soft" style="flex:1" data-ncancel>${esc(t('r3.cancel'))}</button><button class="btn" style="flex:1" data-nsave>${esc(t('r3.save'))}</button></div>
    ${note ? `<button class="linkbtn block" data-ndel style="color:var(--accent);margin-top:8px">${esc(t('r3.deleteNote'))}</button>` : ''}`);
  const q = s => o.querySelector(s);
  q('#nad').onchange = e => { q('#ntimerow').hidden = e.target.checked; };
  q('#nrm').onchange = e => { q('#nrmnote').hidden = e.target.value === 'none'; };
  q('[data-ncancel]').onclick = () => o.remove();
  q('[data-nsave]').onclick = () => {
    const title = q('#nt').value.trim();
    if (!title) { q('#nerr').textContent = '⚠ ' + t('r3.noteTitle'); q('#nt').focus(); return; }
    const rec = { id: n.id, date: n.date, title, text: q('#nx').value.trim(), allDay: q('#nad').checked, time: q('#ntm').value || '09:00', yearly: q('#nyr').checked, remind: q('#nrm').value };
    S.notes = [...(S.notes || []).filter(x => x.id !== rec.id), rec]; save(); o.remove();
    if (rec.remind !== 'none') {
      // Timed: at the time, 8 in the morning of the day, or the day before. All day: the morning, or the morning before.
      const mins = rec.allDay ? 0 : +rec.time.slice(0, 2) * 60 + +rec.time.slice(3, 5);
      const alarm = rec.allDay ? { at: 'PT8H', morning: 'PT8H', before: '-PT16H' }[rec.remind] : { at: 'PT0S', morning: mins > 480 ? `-PT${mins - 480}M` : 'PT0S', before: '-P1D' }[rec.remind];
      const start = rec.allDay ? 0 : zonedUnix(rec.date, rec.time, S.home.tz);
      icsFile(rec.title, [{ uid: rec.id, title: rec.title, text: rec.text, yearly: rec.yearly, alarms: [alarm], ...(rec.allDay ? { date: rec.date } : { start, end: start + 3600 }) }]);
    }
    onDone?.();
  };
  q('[data-ndel]')?.addEventListener('click', () => { S.notes = (S.notes || []).filter(x => x.id !== n.id); save(); o.remove(); onDone?.(); });
  setTimeout(() => q('#nt').focus(), 50);
}

// ---------------------------------------------------------------- the calendar: a day's menu, the marks, the people
function dayMenu(date, x, y, fests, place) {
  const items = [{ label: t('r3.openDay'), icon: 'calendar', fn: () => { dayDate = date; dayPlace = monthPlace; tab = 'today'; render(); } }];
  for (const f of fests.slice(0, 2)) {
    items.push({ label: t(bookmarked(f.id) ? 'r3.unbookmarkFest' : 'r3.bookmarkFest', fname(f)), icon: 'star', fn: () => { toggleBookmark(f.id); toast(bookmarked(f.id) ? t('r3w.bookmarked', fname(f)) : t('r3w.unbookmarked', fname(f))); viewMonth(); } });
    items.push({ label: t('r3w.festToCal', fname(f)), icon: 'calendar', fn: () => festivalIcs(f, date) });
  }
  items.push({ label: t('r3.addNote'), icon: 'book', fn: () => noteEditor(date, null, () => viewMonth()) });
  for (const n of notesOn(date)) items.push({ label: `${t('r3.editNote')}: ${n.title}`, icon: 'book', fn: () => noteEditor(date, n, () => viewMonth()) });
  popMenu(x, y, items);
}
// What the calendar's marks mean, as on iOS (the marks guide).
function legendGuide() {
  const groups = [['star', '<b class="mk">✦</b>'], ['janma', '<b class="mk">✪</b>'], ['moon', '<b>● ○</b>'], ['sun', '<b>↑ ↓</b>'], ['fest', '<i class="fd"></i>'], ['note', `<span class="notepin">${PIN}</span>`]];
  const lines = g => { const out = []; for (let i = 1; STR[`r3.lg.${g}.${i}`]; i++) out.push(t(`r3.lg.${g}.${i}`)); return out; };
  sheet(`<h2 class="serif">${esc(t('r3.legendTitle'))}</h2><div class="calleg lgguide">${groups.map(([g, mark], i) => { const ls = lines(g); return ls.length ? `<div class="lgrow rise" style="--i:${i}"><span class="lgmark">${mark}</span><div>${ls.map(s => `<p>${esc(s)}</p>`).join('')}</div></div>` : ''; }).join('')}</div>
    <p class="small muted">${esc(t('r3.g.note'))}</p>`);
}
// The saved people beneath the month, each a card: star and pada, rashi, the next star birthday and birthday.
// Tapping one shows that person's marks on the month.
async function calPeople(el, sp) {
  const ps = S.people.filter(p => p.kind !== 'remembrance' && p.anchor?.nakshatra), td = today();
  const nextCal = s => { if (!s) return ''; const y = +td.slice(0, 4); let d = `${y}${s.slice(4)}`; if (d < td) d = `${y + 1}${s.slice(4)}`; return d.endsWith('-02-29') && !ymd(parse(d)).endsWith('02-29') ? d.slice(0, 8) + '28' : d; };
  const when = s => { const n = daysBetween(td, s); return n === 0 ? t('day.today') : n === 1 ? t('day.tomorrow') : t('day.inDays', n); };
  const short = s => dtf({ day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parse(s));
  const cards = [];
  for (const p of ps) {
    let star = '';
    for (const y of [+td.slice(0, 4), +td.slice(0, 4) + 1]) {
      const ds = await engine({ op: 'personalDates', handle: await cal(y), anchor: p.anchor, kind: 'birthday', basis: p.basis }).catch(() => []);
      star = ds.find(d => d >= td) || ''; if (star) break;
    }
    const b = nextCal(p.date), a = p.anchor, on = sp && sp.id === p.id;
    cards.push(`<button class="cperson${on ? ' on' : ''}" data-cp="${p.id}" aria-pressed="${on}"><span class="cpname"><b>${esc(p.name)}</b>${on ? `<span class="pill">${esc(t('r3.showingMarks'))}</span>` : ''}</span>
      <span class="small">${esc(name('nakshatras', a.nakshatra))}${a.pada ? ' · ' + esc(t('bs.pada', a.pada)) : ''} · ${esc(name('rashis', a.moonSign))}</span>
      ${star ? `<span class="small"><span class="muted">${esc(t('r3.nextStarBday'))}</span> ${esc(short(star))} · ${esc(when(star))}</span>` : ''}
      ${b ? `<span class="small"><span class="muted">${esc(t('r3.nextBday'))}</span> ${esc(short(b))} · ${esc(when(b))}</span>` : ''}</button>`);
  }
  if (!el.isConnected || tab !== 'calendar') return;
  // The header folds the cards away; folded, it still says whose marks are showing.
  const open = S.calPeopleOpen !== false;
  el.innerHTML = `<button class="cphead" data-cptoggle aria-expanded="${open}"><span class="label">${esc(t('r3.people'))}</span>${!open && sp ? `<span class="cpwho">· ${esc(sp.name)}</span>` : ''}<span class="cpchev${open ? '' : ' shut'}" aria-hidden="true">⌄</span></button>
    ${open ? `${cards.length ? `<div class="cpeople">${cards.join('')}</div>` : ''}<button class="linkbtn" data-cpadd>＋ ${esc(t('r3.addPerson'))}</button>` : ''}`;
  el.querySelector('[data-cptoggle]').onclick = () => { S.calPeopleOpen = !open; save(); viewMonth(); };
  el.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => { S.starPerson = b.dataset.cp; save(); viewMonth(); });
  el.querySelector('[data-cpadd]')?.addEventListener('click', () => personEditor(null, undefined, () => viewMonth()));
}

// ---------------------------------------------------------------- back up and restore
// The web edition has no account: what the user adds lives in this browser. A file carries it to another.
function backupCard() {
  return `<div class="card"><p class="label">${esc(t('r3w.backup'))}</p><p class="small muted" style="margin-top:0">${esc(t('r3w.backupNote'))}</p>
    <p class="small">${esc(t('r3w.backupHolds'))}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn soft" style="flex:1" data-bk>${esc(t('r3w.export'))}</button><button class="btn soft" style="flex:1" data-rs>${esc(t('r3w.import'))}</button></div>
    <input type="file" id="rsfile" accept=".json,application/json" hidden></div>`;
}
function wireBackup(root) {
  root.querySelector('[data-bk]').onclick = () => {
    const file = `eka-panchang-backup-${today()}.json`;
    download(file, JSON.stringify({ app: 'eka-panchang-web', version: 1, exported: new Date().toISOString(), data: S }, null, 1), 'application/json');
    toast(t('r3w.saved', file));
  };
  const input = root.querySelector('#rsfile');
  root.querySelector('[data-rs]').onclick = () => { input.value = ''; input.click(); };
  input.onchange = async () => {
    const f = input.files?.[0]; if (!f) return;
    let j = null; try { j = JSON.parse(await f.text()); } catch {}
    const data = j?.app === 'eka-panchang-web' ? j.data : null;
    if (!data || typeof data !== 'object' || !Array.isArray(data.people ?? [])) return toast(t('r3w.badFile'));
    const when = j.exported ? new Date(j.exported).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const o = sheet(`<h2 class="serif">${esc(t('r3w.restoreTitle'))}</h2><p>${esc(t('r3w.restoreBody', when))}</p>
      <p class="small muted">${esc(t('r3w.restoreCounts', (data.people || []).length, Object.keys(data.vratLog || {}).length, (data.notes || []).length))}</p>
      <div style="display:flex;gap:8px"><button class="btn soft" style="flex:1" data-rno>${esc(t('c.cancel'))}</button><button class="btn" style="flex:1" data-ryes>${esc(t('r3w.restore'))}</button></div>`);
    o.querySelector('[data-rno]').onclick = () => o.remove();
    o.querySelector('[data-ryes]').onclick = () => { try { localStorage.setItem('kaal-web', JSON.stringify(data)); } catch { return toast(t('r3w.badFile')); } location.reload(); };
  };
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
