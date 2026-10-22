// Kaal for the web: the iOS app's screens over the same engine (kaal_wasm),
// the same content packs and the same interface text. Everything is
// unlocked here; settings and profiles stay in this browser.
import { engine } from './engine.js';

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
  { id: 'caribbean', en: 'Caribbean', native: 'कैरिबियाई' },
  { id: 'fijian', en: 'Fiji', native: 'फ़िजी' },
  { id: 'mauritian', en: 'Mauritius', native: 'मॉरीशस' },
];
const LIGHT = ['kaal', 'ivory', 'rose', 'sage'], DARK = ['kaal-dark', 'night', 'charcoal', 'peacock'];
const TABS = [['home', 'hm.home'], ['today', 'tab.today'], ['calendar', 'tab.calendar'], ['festivals', 'tab.festivals'], ['muhurtham', 'tab.muhurtham'],
  ['birthstar', 'bs.title'], ['vrats', 'v.title'], ['jathakam', 'jk.title'], ['sky', 'sk.title'], ['temples', 'tm.title'], ['people', 'pp.title'], ['settings', 'tab.settings']];

// ---------------------------------------------------------------- state
const saved = (() => { try { return JSON.parse(localStorage.getItem('kaal-web') || '{}'); } catch { return {}; } })();
const S = Object.assign({ culture: '', native: false, home: null, theme: 'system', light: 'kaal', dark: 'kaal-dark', people: [], vrats: [], vratLog: {}, families: [] }, saved);
function save() { try { localStorage.setItem('kaal-web', JSON.stringify(S)); } catch {} }

let STR = {}, pack = null, packJson = '', tab = 'home', dayDate = null, monthDate = null;
const handles = new Map();
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- text
const lang = () => (S.native && pack ? pack.language : 'en');
function t(key, ...args) {
  const e = STR[key];
  let s = e ? (e[lang()] ?? e.en) : key;
  // English in the tradition's own vocabulary ("Muhurtham" -> "Shubh Muhurat").
  if (lang() === 'en') for (const [a, b] of pack?.display?.terms || []) s = s.split(a).join(b);
  let i = 0;
  return s.replace(/%(?:(\d+)\$)?([@d])/g, (_, n) => String(args[n ? Number(n) - 1 : i++] ?? ''));
}
const name = (table, key) => { const e = pack?.names?.[table]?.[key]; return e ? (e[lang()] ?? e.en) : (key || ''); };
const fname = f => f.names[lang()] ?? f.names.en;
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
const greg = (s, opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) =>
  new Intl.DateTimeFormat(locale(), { ...opts, timeZone: 'UTC' }).format(parse(s));
const clock = u => new Intl.DateTimeFormat(locale(), { hour: 'numeric', minute: '2-digit', timeZone: here().tz }).format(new Date(u * 1000));
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
  if (!handles.has(key)) handles.set(key, engine({ op: 'open', year, location: place, pack: packJson }).then(r => r.handle));
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
  const tsv = await (await fetch('places.tsv')).text();
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
function shell() {
  const c = CULTURES.find(c => c.id === S.culture);
  $('#badge').textContent = c ? `☀ ${c.native} · ${c.en} ▾` : '';
  $('#badge').onclick = () => { tab = 'settings'; render(); };
  const house = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:4px"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>';
  $('#tabs').innerHTML = TABS.map(([id, k]) => `<button data-tab="${id}" class="${id === tab ? 'on' : ''}">${id === 'home' ? house : ''}${esc(t(k))}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.tab; if (tab === 'today') { dayDate = null; dayPlace = null; } render(); });
  $('#foot').innerHTML = `<div>© ${new Date().getFullYear()} Funtopia App Company</div><div>${esc(t('s.attribution'))}</div>`;
}
function loading() { $('#main').innerHTML = `<div class="loading"><div class="ring"><i></i></div><div class="muted">${esc(t('o.tagline'))}</div></div>`; }
function sheet(html, onOpen) {
  const o = document.createElement('div'); o.className = 'overlay';
  o.innerHTML = `<div class="sheet"><button class="btn soft close noprint">${esc(t('c.close'))}</button>${html}</div>`;
  o.onclick = e => { if (e.target === o) o.remove(); };
  o.querySelector('.close').onclick = () => o.remove();
  document.body.appendChild(o); onOpen?.(o); return o;
}

async function render() {
  applyTheme(); shell();
  if (!S.culture || !S.home) return onboarding();
  try {
    if (tab === 'home') return await viewHome();
    if (tab === 'today') return await viewDay();
    if (tab === 'calendar') return await viewMonth();
    if (tab === 'festivals') return await viewFestivals();
    if (tab === 'muhurtham') return viewMuhurtham();
    if (tab === 'birthstar') return viewBirthStar();
    if (tab === 'vrats') return await viewVrats();
    if (tab === 'jathakam') return await viewJathakam();
    if (tab === 'temples') return await viewTemples();
    if (tab === 'sky') return await viewSky();
    if (tab === 'people') return await viewPeople();
    if (tab === 'settings') return viewSettings();
  } catch (e) { $('#main').innerHTML = `<div class="card">${esc(t('c.error', e.message))}</div>`; }
}

// ---------------------------------------------------------------- onboarding
function onboarding() {
  $('#tabs').innerHTML = '';
  $('#main').innerHTML = `<div class="card"><h1 class="serif" style="margin:0">Kaal</h1><p class="muted">${esc(t('o.welcome'))}</p>
    <p class="label">${esc(t('o.question'))}</p><div class="chips">${CULTURES.map(c => `<button class="chip ${S.culture === c.id ? 'on' : ''}" data-c="${c.id}">${c.native}<br><small>${c.en}</small></button>`).join('')}</div></div>
    <div class="card"><p class="label">${esc(t('o.where'))}</p><p class="small muted">${esc(t('o.whereNote'))}</p><div id="pp"></div></div>`;
  $('#main').querySelectorAll('[data-c]').forEach(b => b.onclick = async () => { S.culture = b.dataset.c; save(); await loadPack(); onboarding(); });
  placePicker($('#pp'), async p => { S.home = p; save(); await resetCalendars(); render(); });
}

// ---------------------------------------------------------------- home
// As on iOS (HomeView): today's panchangam above a tile for every feature,
// each with one live fact; a tile opens its tab.
async function viewHome() {
  const d = today();
  dayDate = null; dayPlace = null;
  loading();
  const p = await day(d);
  const fine = await engine({ op: 'timings', handle: await cal(+d.slice(0, 4)), date: d }).catch(() => null);
  const fest = (await upcoming(d, 90))[0];
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
    temples: '<path d="M12 2.5v2M9.5 8h5l-1-3.5h-3zM8 12h8l-1.5-4h-5zM6 20.5h12V12H6z"/><path d="M10.5 20.5v-4a1.5 1.5 0 0 1 3 0v4M4 20.5h16"/>',
    people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9.5" r="2.3"/><path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5M15 14c3 0 5.5 1.8 5.5 5"/>',
    birthstar: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M17 3v4M15 5h4"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    muhurtham: '<circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="M10 4l2 3 2-3"/>',
  }[k]);
  const svg = k => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon(k)}</svg>`;
  const tile = (k, go, tone, label, value, detail) => `<button class="tile ${tone}" data-go="${go}"><span class="ic">${svg(k)}</span>
    <span class="tx"><span class="lb">${esc(label)}</span><b>${esc(value)}</b>${detail ? `<span class="dt">${esc(detail)}</span>` : ''}</span></button>`;
  const tiles = [
    tile('festivals', 'festivals', 'warm', t('tab.festivals'), fest ? fname(fest.f) : t('f.upcoming'), fest ? when(fest.date) : ''),
    tile('day', 'today', 'accent', t('dm.title'), chog ? chog[0] : t('time.section'), chog ? chog[1] : ''),
    tile('vrats', 'vrats', 'gold', t('vj.title'), vrat ? recName(vrat.key) : t('v.title'), vrat ? when(vrat.date) : kept ? t('vj.keptOf', String(kept)) : ''),
    tile('calendar', 'calendar', 'accent', t('tab.calendar'), greg(d, { month: 'long', year: 'numeric' }), yearLabel(p.year)),
    tile('jathakam', 'jathakam', 'accent', t('jk.chart'), t('jk.title'), [t('jk.vimshottari'), t('jk.yogini'), t('jk.chara')].join(' · ')),
    tile('sky', 'sky', 'gold', t('sk.title'), t('sk.now'), ''),
    tile('temples', 'temples', 'warm', t('tm.title'), t('tm.deity'), ['vishnu', 'shiva', 'devi'].map(x => t('deity.' + x)).join(' · ')),
    tile('people', 'people', 'accent', t('fam.family'), person ? t(person.p.kind === 'remembrance' ? 'pp.remembranceOf' : 'pp.birthdayOf', person.p.name) : t('pp.title'), person ? when(person.date) : t('pp.add')),
    tile('birthstar', 'birthstar', 'gold', t('bs.result'), t('bs.title'), ''),
    tile('settings', 'settings', 'quiet', t('tab.settings'), c ? (S.native ? c.native : c.en) : '', t('s.notifications')),
  ];
  $('#main').innerHTML = `<div class="home">
    <div class="homehead"><div><div class="small muted"><b>${esc(greg(d))}</b></div><div class="serif wordmark">Kaal</div></div>
      <button class="placepill" data-go="settings">📍 ${esc(S.home.name)}</button></div>
    <div class="homehero">
      <button class="hero" data-go="today">
        <span class="herotop"><span>${esc(t('p.panchang'))}</span><span aria-hidden="true">☀</span></span>
        <span class="serif herodate">${esc(cultureDate(p.solar, p.lunar))}</span>
        <span class="herosub">${esc(tithi)}</span>
        <span class="herosub small">${esc(yearLabel(p.year))}</span>
        <span class="hcells">${[[t('p.nakshatra'), p.nakshatras[0] ? name('nakshatras', p.nakshatras[0].key) : '–'], [t('sun.sunrise'), clock(p.sunrise)], [t('sun.sunset'), clock(p.sunset)]]
          .map(([l, v]) => `<span class="hcell"><span>${esc(l)}</span><b>${esc(v)}</b></span>`).join('')}</span>
        <span class="rahu">${esc(t('time.rahu'))} ${esc(span(p.rahuKalam))}</span>
      </button>
      <button class="wide" data-go="muhurtham"><span class="ic">${svg('muhurtham')}</span>
        <span class="tx"><span class="lb">${esc(t('tab.muhurtham'))}</span><span class="serif big">${esc(t('m.pwTitle'))}</span><span class="dt">${esc(events.join(', '))}…</span></span><span class="chev" aria-hidden="true">›</span></button>
    </div>
    <div class="tiles">${tiles.join('')}</div>
    <div class="small muted" style="text-align:center;margin-top:8px">Kaal · ${esc(t('o.tagline'))}</div></div>`;
  $('#main').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { tab = b.dataset.go; render(); scrollTo(0, 0); });
  // The year's sky takes a few seconds; its tile fills in when ready, next year only if this one is over.
  const y = +d.slice(0, 4);
  let sky = (await skyEvents(y).catch(() => [])).find(e => e.at > now);
  if (!sky) sky = (await skyEvents(y + 1).catch(() => [])).find(e => e.at > now);
  const el = tab === 'home' && $('#main .tile[data-go="sky"] .tx');
  if (el && sky) el.innerHTML = `<span class="lb">${esc(t('sk.title'))}</span><b>${esc(skyTitle(sky))}</b><span class="dt">${esc(new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: S.home.tz }).format(new Date(sky.at * 1000)))}</span>`;
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
      ${d !== today() ? `<button class="btn soft noprint" data-today>${esc(t('day.jumpToday'))}</button>` : ''}</div>
    ${fests.length || recs.length || people.length || skyToday.length ? `<p class="label">${esc(t('day.observances'))}</p>` : ''}
    ${skyToday.map(e => `<div class="rec" data-goto-sky style="cursor:pointer">✦ ${esc(skyTitle(e))} · ${esc(clock(e.at))}</div>`).join('')}
    ${fests.map(({ f, o }) => `<div class="fest ${f.tier === 'major' ? 'major' : ''}" data-f="${esc(f.id)}" data-d="${o.date}"><div class="bar2"></div><div><b>${esc(fname(f))}</b><div class="small muted">${esc(fother(f))}</div><div class="small muted">${esc(text(f.content?.summary))}</div></div><div class="when">›</div></div>`).join('')}
    ${people.map(x => `<div class="rec">🎁 <b>${esc(x.title)}</b> <span class="small muted">${esc(x.line)}</span></div>`).join('')}
    ${recs.map(k => { const r = pack.dailySignificance.find(r => r.key === k); return `<div class="rec">🌙 <b>${esc(recName(k))}</b><div class="small muted">${esc(text(r?.content?.summary))}</div></div>`; }).join('')}
    ${parana ? `<div class="card"><p class="label">${esc(t('v.parana'))}</p><div style="font-size:20px;font-weight:700">${esc(span(parana))}</div>${parana.dvadashiEnd ? `<div class="small muted">${esc(t('v.dvadashiEnds', clock(parana.dvadashiEnd)))}</div>` : ''}<div class="small muted">${esc(t('v.paranaWhy'))}</div></div>` : ''}
    <div class="card"><p class="label">${esc(t('p.panchang'))}</p>
      ${[[t('p.tithi'), (p.lunar ? name('paksha', p.lunar.paksha) + ' ' : '') + tv, td], [t('p.nakshatra'), nv, nd], [t('p.yoga'), yv, yd], [t('p.karana'), kv, kd]]
        .map(([l, v, s]) => `<div class="row"><span class="muted">${esc(l)}</span><span class="v">${esc(v)}<small>${esc(s)}</small></span></div>`).join('')}</div>
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
    <button class="btn soft block noprint" onclick="window.print()">🖨 ${esc(t('pdf.share'))}</button>`;
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
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', timeZone: here().tz }).format(new Date(u * 1000)) + ' ' + clock(u);
}
function windowText(a, b, d) { return civilIn(a) === civilIn(b) ? `${stamp(a, d)} – ${clock(b)}` : `${stamp(a, d)} – ${stamp(b, d)}`; }
function windowsRow(k, ps, d) {
  return ps.length ? `<div class="row"><span>${esc(t(k))}</span><span class="v">${ps.map(p => esc(windowText(p.start, p.end, d))).join('<br>')}</span></div>` : '';
}
// As on iOS (dayPartKinds): the tradition's own ways of dividing the day, its own first.
function mKinds() {
  if (['tamil', 'sri-lankan-tamil', 'malaysian-tamil', 'telugu'].includes(S.culture)) return ['gowri', 'hora', 'lagna'];
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
  return `<p class="label">${esc(t('dm.title'))}</p>
    <div class="seg" style="margin-bottom:8px">${mKinds().map(x => `<button data-mk="${x}" class="${k === x ? 'on' : ''}">${esc(t('dm.' + x))}</button>`).join('')}</div>
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
    <div class="dayhead" style="margin:0"><div class="nav"><button class="arrow" data-vc="-1">‹</button><b class="serif" style="font-size:20px">${esc(new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(m)))}</b><button class="arrow" data-vc="1">›</button></div></div>
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

// ---------------------------------------------------------------- jathakam
// As on iOS (Views/JatakamViews.swift): the chart and its vargas in South,
// North or East Indian style, three dasha systems, and the family's dasha
// sandhis. Charts only, no reading.
let jkSection = 0, jkPerson = null, jkVarga = 1, jkSystem = 'vimshottari', jkAhead = true, jkSpan = 20;
const jkCache = new Map();
const births = () => S.people.filter(p => p.kind !== 'remembrance' && p.place);
// As on iOS (GunaMilanViews): each tradition's own matching - Porutham in the
// South, Ashtakoota Guna Milan elsewhere. Guna Milan stays off until the corpus
// (content/validation/ashtakoota-corpus.md) agrees with Drik; ?gm=1 shows it for checking.
const GUNA_MILAN_RELEASED = new URLSearchParams(location.search).has('gm');
const matchesByPorutham = () => ['malayalam', 'tamil', 'telugu', 'kannada', 'sri-lankan-tamil', 'malaysian-tamil'].includes(S.culture);
async function gunaMilanSheet(bride, groom) {
  const side = p => ({ date: p.date, minutes: p.minutes ?? undefined, location: p.place });
  const r = await engine({ op: 'gunaMilan', bride: side(bride), groom: side(groom) });
  const m = r.milan, pts = x => Number.isInteger(x) ? String(x) : x.toFixed(1);
  const sideName = (k, v) => k.key === 'bhakoot' ? name('rashis', v) : k.key === 'graha-maitri' ? name('grahas', v) : v.charAt(0).toUpperCase() + v.slice(1);
  const rule = (key, of) => `<div class="card" style="background:var(--sunken)"><p class="small">${esc(t(key))}</p><p class="small muted"><b>${esc(t('gm.cancel'))}</b></p>
    ${m.cancellations.filter(c => c.of === of).map(c => `<div class="small" style="color:${c.holds ? 'var(--accent)' : 'var(--muted)'}">· ${esc(t('gm.c.' + c.condition))}: ${esc(t(c.holds ? 'gm.holds' : 'gm.notHold'))}</div>`).join('')}</div>`;
  const kuja = (p, list) => `<div class="small"><b>${esc(p.name)}</b>${list.map(k => `<div style="color:${k.listed ? 'var(--accent)' : 'var(--muted)'}">${esc(t('jk.kujaRow', k.house, k.from === 'lagna' ? t('jk.lagnaWord') : name('grahas', k.from)))} · ${esc(t(k.listed ? 'jk.kujaListed' : 'jk.kujaNot'))}</div>`).join('')}</div>`;
  sheet(`<h2 class="serif">${esc(t('gm.title'))}</h2><div style="font-size:24px;font-weight:700;color:var(--accent)">${esc(t('gm.total', pts(m.total)))}</div>
    <p style="font-weight:600">${esc(t('gm.band.' + m.band))}</p>
    <div class="card">${m.kootas.map(k => `<div class="row"><span>${esc(t('gm.' + k.key))}<small class="muted" style="display:block">${esc(t('gm.sides', sideName(k, k.bride), sideName(k, k.groom)))}</small></span><span class="v">${pts(k.points)} / ${pts(k.max)}</span></div>`).join('')}</div>
    ${m.nadiZero ? rule('gm.nadiRule', 'nadi') : ''}${m.bhakootZero ? rule('gm.bhakootRule', 'bhakoot') : ''}
    <div class="card"><p class="label">${esc(t('gm.manglik'))}</p>${kuja(bride, r.brideKuja)}${kuja(groom, r.groomKuja)}</div>
    <p class="small muted">${esc(t('gm.note'))}</p>`);
}

async function jataka(p) {
  const key = `${p.id}|${p.date}|${p.minutes}|${p.place.latitude}`;
  if (!jkCache.has(key)) jkCache.set(key, engine({ op: 'jataka', date: p.date, minutes: p.minutes ?? undefined, location: p.place }));
  return jkCache.get(key);
}
const SIGNS = ['mesha', 'vrishabha', 'mithuna', 'karka', 'simha', 'kanya', 'tula', 'vrishchika', 'dhanu', 'makara', 'kumbha', 'meena'];
const GCOL = { sun: '#E08A2E', moon: '#8FA7C4', mars: '#C6453A', mercury: '#3E9B5C', jupiter: '#E2B53A', venus: '#D58AB4', saturn: '#3D4F8F', rahu: '#6E6A63', ketu: '#9A6B45' };
const chartStyle = () => S.chartStyle || ({ tamil: 'south', 'sri-lankan-tamil': 'south', 'malaysian-tamil': 'south', malayalam: 'south', telugu: 'south', kannada: 'south', bengali: 'east', odia: 'east' }[S.culture] || 'north');
const vargaName = n => `D${n} · ${name('vargas', 'd' + n)}`;
const dLabel = u => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(u * 1000));
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
    const fam = []; for (const p of ps.filter(x => !jkFamily || x.family === jkFamily)) fam.push([p, await jataka(p)]);
    const Y = 31557600, from = jkAhead ? now : now - jkSpan * Y, to = jkAhead ? now + jkSpan * Y : now;
    const sandhis = [];
    for (const [p, jj] of fam) { const ms = jj.vimshottari.periods; for (let i = 1; i < ms.length; i++) if (ms[i].start >= from && ms[i].start < to) sandhis.push({ p, a: ms[i - 1], b: ms[i], s: ms[i - 1].children.at(-1).start, e: ms[i].children[0].end }); }
    sandhis.sort((x, y) => jkAhead ? x.b.start - y.b.start : y.b.start - x.b.start);
    const pct = u => ((Math.min(Math.max(u, from), to) - from) / (to - from) * 100).toFixed(2);
    body += `<div style="display:flex;gap:8px;align-items:center"><div class="seg" style="flex:1"><button data-ahead="1" class="${jkAhead ? 'on' : ''}">${esc(t('jk.ahead'))}</button><button data-ahead="0" class="${!jkAhead ? 'on' : ''}">${esc(t('jk.past'))}</button></div>
      <select id="jkspan" style="width:auto">${[10, 20, 40].map(n => `<option value="${n}" ${n === jkSpan ? 'selected' : ''}>${esc(t('jk.span', n))}</option>`).join('')}</select></div>
      ${S.families.length > 1 ? `<div class="vc-chips"><button class="pill ${!jkFamily ? 'on' : ''}" data-jf="">${esc(t('f.all'))}</button>${S.families.map(f => `<button class="pill ${jkFamily === f.id ? 'on' : ''}" data-jf="${f.id}">${esc(f.name)}</button>`).join('')}</div>` : ''}
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
  const when = u => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', timeZone: S.home.tz }).format(new Date(u * 1000)) + ' · ' + clock(u);
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
  const month = u => new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: tz }).format(new Date(u * 1000));
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
let tmNear = null;
function kmFrom(o, x) {
  const r = Math.PI / 180, p1 = o.latitude * r, p2 = x.lat * r, dp = p2 - p1, dl = (x.lon - o.longitude) * r;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function distText(km) {
  const miles = /^en-(US|GB|LR|MM)$/.test(navigator.language || '');
  const v = miles ? km / 1.609344 : km;
  return new Intl.NumberFormat(locale(), { style: 'unit', unit: miles ? 'mile' : 'kilometer', maximumFractionDigits: 0 }).format(v);
}
async function viewTemples() {
  TEMPLES ??= await (await fetch('temples.json')).json();
  const yours = [...new Set(S.vrats.map(deityForVrat).filter(Boolean))];
  const order = [...yours, ...TEMPLES.deities.filter(d => !yours.includes(d))];
  const origin = tmNear || S.home;
  const shown = tmDeity ? [tmDeity] : order;
  const card = x => `<div class="card temple"><h2 class="serif">${esc(x.name)}</h2><div class="small muted tmplace"><span>📍 ${esc(x.place)}</span><span>${esc(distText(kmFrom(origin, x)))}</span></div><p>${esc(x.about)}</p>
    ${x.donate ? `<a class="btn block" href="${esc(x.donate)}" target="_blank" rel="noopener">♥ ${esc(t('tm.donate'))}</a>` : x.site ? '' : `<p class="small muted">${esc(t('tm.noLink'))}</p>`}
    <div class="links">${x.site && x.site !== x.donate ? `<a href="${esc(x.site)}" target="_blank" rel="noopener">🌐 ${esc(t('tm.site'))}</a>` : ''}
    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.name + ', ' + x.place)}" target="_blank" rel="noopener">🗺 ${esc(t('tm.directions'))}</a></div></div>`;
  const groups = shown.map(d => {
    const list = TEMPLES.temples.filter(x => x.deity === d).sort((a, b) => kmFrom(origin, a) - kmFrom(origin, b));
    return list.length ? `${tmDeity ? '' : `<h2 class="serif tmdeity">${esc(t('deity.' + d))}</h2>`}${list.map(card).join('')}` : '';
  }).join('');
  $('#main').innerHTML = `<div class="card tmnear"><div class="row" style="border:0;align-items:center"><b>📍 ${esc(t('tm.near', origin.name))}</b>
      <span>${tmNear ? `<button class="btn soft" data-tmhome>${esc(t('dual.home'))}</button> ` : ''}<button class="btn soft" data-tmpick>${esc(t('cal.other'))}</button></span></div><div id="tmpp"></div></div>
    ${yours.length ? `<p class="label">${esc(t('tm.yours'))}</p>` : ''}
    <div class="vc-chips"><button class="pill ${!tmDeity ? 'on' : ''}" data-deity="">${esc(t('f.all'))}</button>${order.map(d => `<button class="pill ${d === tmDeity ? 'on' : ''}" data-deity="${d}">${yours.includes(d) ? '☾ ' : ''}${esc(t('deity.' + d))}</button>`).join('')}</div>
    ${groups}<p class="small muted">${esc(t('tm.note'))}</p>`;
  $('#main').querySelectorAll('[data-deity]').forEach(b => b.onclick = () => { tmDeity = b.dataset.deity || null; viewTemples(); });
  $('#main').querySelector('[data-tmhome]')?.addEventListener('click', () => { tmNear = null; viewTemples(); });
  $('#main').querySelector('[data-tmpick]').onclick = () => placePicker($('#tmpp'), p => { tmNear = p; viewTemples(); });
}

// ---------------------------------------------------------------- festival page
async function festivalSheet(id, date) {
  const f = pack.festivals.find(x => x.id === id); if (!f) return;
  const handle = await cal(+date.slice(0, 4));
  const [p, w, occ] = await Promise.all([day(date), engine({ op: 'window', handle, id, date }), engine({ op: 'festivals', handle })]);
  const how = occ.find(o => o.id === id && o.date === date)?.how || '';
  const steps = f.content?.howTo ? (f.content.howTo[lang()] ?? f.content.howTo.en ?? []) : [];
  sheet(`<div style="clear:both"></div>
    ${f.tier === 'major' ? `<span class="pill">${esc(t('f.major'))}</span>` : ''}${f.holidayIn?.length ? `<span class="pill">${esc(t('f.holiday'))}</span>` : ''}
    <h1 class="serif" style="margin:6px 0 0">${esc(fname(f))}</h1><div class="muted">${esc(fother(f))}</div>
    <div style="color:var(--accent);font-weight:700;margin-top:6px">${esc(greg(date))}</div>
    <div class="small muted">📍 ${esc(t('f.forPlace', S.home.name))} · ${esc(cultureDate(p.solar, p.lunar))}</div>
    <p>${esc(text(f.content?.summary))}</p>
    ${w ? `<div class="card"><p class="label">${esc(t('f.pujaTime'))}</p><div>${esc(t('f.keptAt', t('k.' + w.kala)))}</div><div style="font-size:20px;font-weight:700;color:var(--accent)">${esc(w.start === w.end ? clock(w.start) : span(w))}</div><div class="small muted">${esc(t('f.pujaFor', S.home.name))}</div></div>` : ''}
    ${f.content?.traditions ? `<div class="card"><p class="label">${esc(t('f.traditions'))}</p><p>${esc(text(f.content.traditions))}</p></div>` : ''}
    ${f.content?.story ? `<div class="card"><p class="label">${esc(t('f.story'))}</p><p>${esc(text(f.content.story))}</p></div>` : ''}
    ${steps.length ? `<div class="card"><p class="label">${esc(t('f.howTo'))}</p><ol>${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>` : ''}
    ${f.variations?.length ? `<div class="card"><p class="label">${esc(t('f.notes'))}</p>${f.variations.map(v => `<p class="small">${esc(v)}</p>`).join('')}</div>` : ''}
    ${how ? `<div class="card"><p class="label">${esc(t('f.dateHow'))}</p><p class="small muted">${esc(how)}</p></div>` : ''}
    <button class="btn soft block noprint" onclick="window.print()">🖨 ${esc(t('pdf.share'))}</button>`);
}

// ---------------------------------------------------------------- month
async function viewMonth() {
  const m = monthDate || today().slice(0, 8) + '01';
  loading();
  const [y, mo] = m.split('-').map(Number);
  const last = `${y}-${pad(mo)}-${pad(new Date(Date.UTC(y, mo, 0)).getUTCDate())}`;
  const place = monthPlace || S.home;
  const cells = await engine({ op: 'month', handle: await cal(y, place), from: m, to: last });
  const solar = pack.display.primary === 'solar';
  const head = [...new Set(cells.map(c => solar ? name('solarMonths', c.solar?.month) : (c.lunar?.adhika ? name('adhika', 'adhika') + ' ' : '') + name('lunarMonths', c.lunar?.month)))].join(' – ');
  const wd = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(k => {
    const n = name('weekdays', k); if (lang() === 'en') return n.slice(0, 3);
    for (const s of ['వారం', 'ವಾರ', 'वार', 'கிழமை', 'ആഴ്ച', 'વાર', 'বার', 'ବାର']) if (n.endsWith(s) && n.length > s.length) return n.slice(0, -s.length);
    return n;
  });
  const lead = parse(m).getUTCDay(), td = today(place.tz);
  const marked = ['ekadashi', 'purnima', 'pournami', 'amavasya', 'amavasai', 'karuthavavu'];
  const items = [];
  const grid = cells.map(c => {
    const fs = c.festivals.map(id => pack.festivals.find(f => f.id === id)).filter(f => f && !f.hidden);
    fs.forEach(f => items.push({ f, date: c.date }));
    const major = fs.some(f => f.tier === 'major'), special = c.recurring.some(r => marked.includes(r));
    const sub = solar && c.solar ? String(c.solar.day) : name('tithis', c.tithi);
    return `<div class="cell ${fs.length ? 'fest' : ''} ${c.date === td ? 'today' : ''}" data-day="${c.date}" title="${esc(greg(c.date))}">
      <div class="d">${+c.date.slice(8)}</div><div class="t">${esc(sub)}</div><div class="n">${esc(name('nakshatras', c.nakshatra))}</div>
      <div>${fs.length ? `<span class="dot ${major ? 'major' : ''}"></span>` : ''}${special ? '<span class="dot hollow"></span>' : ''}</div></div>`;
  }).join('');
  $('#main').innerHTML = `<div class="dayhead"><div class="nav"><button class="arrow" data-m="-1">‹</button>
      <div><h1 class="serif" style="font-size:24px">${esc(head)}</h1><div class="muted">${esc(new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(m)))}</div>
      <select class="placechip noprint" aria-label="${esc(t('cal.location'))}"><option value="home" ${!monthPlace ? 'selected' : ''}>📍 ${esc(S.home.name)}</option>
        ${monthPlace ? `<option value="other" selected>📍 ${esc(monthPlace.name)}</option>` : ''}<option value="pick">${esc(t('cal.other'))}</option></select></div>
      <button class="arrow" data-m="1">›</button></div></div>
    <div class="grid">${wd.map(w => `<div class="wd">${esc(w)}</div>`).join('')}${'<div class="cell empty"></div>'.repeat(lead)}${grid}</div>
    <p class="small muted" style="margin-top:10px"><span class="dot major"></span> ${esc(t('f.major'))} &nbsp; <span class="dot"></span> ${esc(t('tab.festivals'))} &nbsp; <span class="dot hollow"></span> ${['ekadashi', 'purnima', 'amavasya'].map(k => esc(name('tithis', k))).join(' · ')}</p>
    ${items.length ? `<p class="label" style="margin-top:16px">${esc(t('tab.festivals'))}</p>` : ''}
    ${items.map(x => festRow(x.f, x.date)).join('')}
    <div class="noprint" style="display:flex;gap:8px"><button class="btn soft" style="flex:1" onclick="window.print()">🖨 ${esc(t('pdf.month'))}</button><button class="btn soft" style="flex:1" data-year>🖨 ${esc(t('pdf.year'))}</button></div>`;
  $('#main').querySelector('[data-year]').onclick = () => printYear(y, place);
  $('#main').querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    const d = parse(m); d.setUTCMonth(d.getUTCMonth() + +b.dataset.m, 1); monthDate = ymd(d); viewMonth();
  });
  $('#main').querySelectorAll('[data-day]').forEach(c => c.onclick = () => { dayDate = c.dataset.day; dayPlace = monthPlace; tab = 'today'; render(); });
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
  const title = t('pdf.yearTitle', c ? (S.native ? c.native : c.en) : 'Kaal', y);
  const fests = cells.flatMap(x => x.festivals.map(id => pack.festivals.find(f => f.id === id)).filter(f => f && !f.hidden && f.tier !== 'minor').map(f => ({ f, date: x.date })));
  const wd = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(k => name('weekdays', k).slice(0, lang() === 'en' ? 3 : 4));
  let html = `<div class="yearprint"><h1 class="serif">${esc(title)}</h1><p class="small muted">${esc(t('f.forPlace', place.name))}</p>${fests.map(x => festRow(x.f, x.date)).join('')}`;
  for (let mo = 1; mo <= 12; mo++) {
    const mc = cells.filter(x => +x.date.slice(5, 7) === mo);
    const head = [...new Set(mc.map(x => solar ? name('solarMonths', x.solar?.month) : name('lunarMonths', x.lunar?.month)))].join(' – ');
    const lead = parse(`${y}-${pad(mo)}-01`).getUTCDay();
    html += `<section class="ym"><h2 class="serif">${esc(head)}</h2><div class="muted">${esc(new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(`${y}-${pad(mo)}-01`)))}</div>
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
    <div style="min-width:44px;text-align:center"><b>${+date.slice(8)}</b><div class="small muted">${esc(new Intl.DateTimeFormat(locale(), { month: 'short', timeZone: 'UTC' }).format(parse(date)))}</div></div>
    <div><b>${esc(fname(f))}</b><div class="small muted">${esc(fother(f))}</div></div>
    <div class="when">${n === 0 ? esc(t('day.today')) : n === 1 ? esc(t('day.tomorrow')) : n > 1 ? esc(t('day.inDays', n)) : ''}</div></div>`;
}

// ---------------------------------------------------------------- festivals
let majorOnly = true;
async function viewFestivals() {
  loading();
  const list = (await upcoming(today(), 370)).filter(x => !majorOnly || x.f.tier !== 'minor');
  // Under All, the recurring observances too, date only (as on iOS: weekly vrats only if kept,
  // a plain Ekadashi left out where a named one falls the same day).
  if (!majorOnly) {
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
  let html = `<div class="seg noprint" style="margin-bottom:12px"><button data-maj="1" class="${majorOnly ? 'on' : ''}">${esc(t('f.major'))}</button><button data-maj="0" class="${!majorOnly ? 'on' : ''}">${esc(t('f.all'))}</button></div>`;
  let month = '';
  for (const x of list) {
    const mm = x.date.slice(0, 7);
    if (mm !== month) { month = mm; html += `<p class="label" style="margin-top:14px">${esc(new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(x.date)))}</p>`; }
    html += x.obs ? `<div class="list-row obs"><span style="color:var(--gold)">☾</span><span class="grow">${esc(recName(x.obs))}</span><span class="small muted">${esc(new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parse(x.date)))}</span></div>` : festRow(x.f, x.date);
  }
  $('#main').innerHTML = html + `<button class="btn soft block noprint" onclick="window.print()">🖨 ${esc(t('pdf.share'))}</button>`;
  $('#main').querySelectorAll('[data-maj]').forEach(b => b.onclick = () => { majorOnly = b.dataset.maj === '1'; viewFestivals(); });
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
        const btn = q('#psave'); btn.disabled = true; btn.textContent = '…';
        await preview();
        btn.disabled = false; btn.textContent = t('c.save');
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
    const mine = ++seq; $('#bres').textContent = '…';
    let html; try { html = anchorCard(await anchorFor(d, minutes, place)); } catch { html = esc(t('pp.failed')); }
    if (mine === seq) $('#bres').innerHTML = html;
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
    return `<p class="label" style="margin-top:14px">${esc(new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(m.date)))} · ${esc(t('m.inMonth', n))}</p>`;
  };
  $('#mres').innerHTML = !list.length ? `<div class="card muted">${esc(t('m.none'))}</div>` : `
    ${M.results.months ? '' : `<div class="seg noprint" style="margin-bottom:8px"><button data-bd="0" class="${!M.byDate ? 'on' : ''}">${esc(t('m.best'))}</button><button data-bd="1" class="${M.byDate ? 'on' : ''}">${esc(t('m.byDate'))}</button></div>`}
    <p class="small muted">${esc(t('m.found', list.length))}</p>
    <button class="btn soft block noprint" onclick="window.print()" style="margin-bottom:10px">🖨 ${esc(t('pdf.share'))}</button>
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

// ---------------------------------------------------------------- porutham
async function poruthamSheet(bride, groom) {
  const ten = await engine({ op: 'porutham', bride: { nakshatra: bride.anchor.nakshatra, moonSign: bride.anchor.moonSign }, groom: { nakshatra: groom.anchor.nakshatra, moonSign: groom.anchor.moonSign } });
  sheet(`<div style="clear:both"></div><h2 class="serif">${esc(t('pr.title'))}</h2>
    <div><b>${esc(t('pdf.couple', bride.name, groom.name))}</b></div>
    <div class="small muted">${esc(t('m.bride'))}: ${esc(natalLine(bride.anchor))}</div><div class="small muted">${esc(t('m.groom'))}: ${esc(natalLine(groom.anchor))}</div>
    <h3 style="color:var(--accent)">${esc(t('pr.summary', ten.filter(p => p.matching === true).length))}</h3>
    <div class="card">${ten.map(p => `<div class="list-row"><span class="${p.matching ? 'tick' : 'cross'}">${p.matching === true ? '✓' : p.matching === false ? '✗' : '–'}</span>
      <div class="grow"><b>${esc(t('pr.' + p.key))}</b> ${p.critical ? `<span class="pill">${esc(t('pr.weighed'))}</span>` : ''}
      <div class="small muted">${esc(t('pr.' + p.key + '.about'))}</div>
      <div class="small"><b>${esc(t(p.matching === true ? 'pr.agrees' : p.matching === false ? 'pr.differs' : 'pr.undecided'))}</b> · <span class="muted">${esc(p.detail)}</span></div></div></div>`).join('')}</div>
    <p class="small muted">${esc(t('pr.note'))}</p>
    <button class="btn soft block noprint" onclick="window.print()">🖨 ${esc(t('pdf.share'))}</button>`);
}

// ---------------------------------------------------------------- settings
function viewSettings() {
  $('#main').innerHTML = `<div class="card"><p class="label">${esc(t('s.tradition'))}</p>
      <div class="chips">${CULTURES.map(c => `<button class="chip ${S.culture === c.id ? 'on' : ''}" data-c="${c.id}">${c.native}<br><small>${c.en}</small></button>`).join('')}</div>
      <label class="field"><span>${esc(t('s.language'))}</span><div class="seg"><button data-l="0" class="${!S.native ? 'on' : ''}">English</button><button data-l="1" class="${S.native ? 'on' : ''}">${esc(pack.display.nameNative)}</button></div></label></div>
    <div class="card"><p class="label">${esc(t('s.home'))}</p><div><b>${esc(S.home.name)}</b> <span class="small muted">${esc([S.home.region, S.home.country].filter(Boolean).join(', '))}</span></div><div id="hp" style="margin-top:8px"></div></div>
    <div class="card"><p class="label">${esc(t('s.appearance'))}</p>
      <div class="seg">${['system', 'light', 'dark'].map(m => `<button data-th="${m}" class="${S.theme === m ? 'on' : ''}">${esc(t('s.' + m))}</button>`).join('')}</div>
      <p class="small muted" style="margin-top:10px">${esc(t('th.light'))}</p><div class="chips">${LIGHT.map(id => `<button class="chip ${S.light === id ? 'on' : ''}" data-lt="${id}">${esc(t('th.' + id))}</button>`).join('')}</div>
      <p class="small muted" style="margin-top:10px">${esc(t('th.dark'))}</p><div class="chips">${DARK.map(id => `<button class="chip ${S.dark === id ? 'on' : ''}" data-dk="${id}">${esc(t('th.' + id))}</button>`).join('')}</div></div>
    <div class="card"><p class="label">${esc(t('s.about'))}</p><p class="small">${esc(t('web.what'))}</p><p class="small">${esc(t('web.privacy'))}</p>
      <p class="small muted">${esc(t('s.attribution'))}</p><p class="small"><a href="https://funtopiaapp.github.io/kaal-privacy/">${esc(t('mn.support'))}</a> · <a href="https://funtopiaapp.github.io/kaal-privacy/privacy.html">${esc(t('mn.privacy'))}</a></p>
      <p class="small muted">Web edition for testing · all features unlocked</p></div>`;
  $('#main').querySelectorAll('[data-c]').forEach(b => b.onclick = async () => { S.culture = b.dataset.c; save(); await loadPack(); await resetCalendars(); render(); });
  $('#main').querySelectorAll('[data-l]').forEach(b => b.onclick = () => { S.native = b.dataset.l === '1'; save(); render(); });
  $('#main').querySelectorAll('[data-th]').forEach(b => b.onclick = () => { S.theme = b.dataset.th; save(); render(); });
  $('#main').querySelectorAll('[data-lt]').forEach(b => b.onclick = () => { S.light = b.dataset.lt; save(); render(); });
  $('#main').querySelectorAll('[data-dk]').forEach(b => b.onclick = () => { S.dark = b.dataset.dk; save(); render(); });
  placePicker($('#hp'), async p => { S.home = p; save(); await resetCalendars(); tab = 'today'; render(); });
}

// ---------------------------------------------------------------- boot
async function loadPack() {
  if (!S.culture) return;
  packJson = await (await fetch(`packs/${S.culture}.json`)).text();
  pack = JSON.parse(packJson);
}
(async () => {
  STR = await (await fetch('strings.json')).json();
  await loadPack();
  render();
})();
