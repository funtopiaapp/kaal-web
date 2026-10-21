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
];
const LIGHT = ['kaal', 'ivory', 'rose', 'sage'], DARK = ['kaal-dark', 'night', 'charcoal', 'peacock'];
const TABS = [['today', 'tab.today'], ['calendar', 'tab.calendar'], ['festivals', 'tab.festivals'], ['muhurtham', 'tab.muhurtham'],
  ['birthstar', 'bs.title'], ['people', 'pp.title'], ['settings', 'tab.settings']];

// ---------------------------------------------------------------- state
const saved = (() => { try { return JSON.parse(localStorage.getItem('kaal-web') || '{}'); } catch { return {}; } })();
const S = Object.assign({ culture: '', native: false, home: null, theme: 'system', light: 'kaal', dark: 'kaal-dark', people: [] }, saved);
function save() { try { localStorage.setItem('kaal-web', JSON.stringify(S)); } catch {} }

let STR = {}, pack = null, packJson = '', tab = 'today', dayDate = null, monthDate = null;
const handles = new Map();
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- text
const lang = () => (S.native && pack ? pack.language : 'en');
function t(key, ...args) {
  const e = STR[key];
  let s = e ? (e[lang()] ?? e.en) : key;
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
function today() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: S.home?.tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p;
}
const greg = (s, opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) =>
  new Intl.DateTimeFormat(locale(), { ...opts, timeZone: 'UTC' }).format(parse(s));
const clock = u => new Intl.DateTimeFormat(locale(), { hour: 'numeric', minute: '2-digit', timeZone: S.home.tz }).format(new Date(u * 1000));
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
  return y.samvatsara ? `${name('samvatsaras', y.samvatsara)} · ${name('eras', y.era)}` : `${name('eras', y.era)} ${y.number ?? ''}`;
}
const tithiName = n => (n === 15 || n === 30 ? '' : name('paksha', n < 15 ? 'shukla' : 'krishna') + ' ') + name('tithis', tithiKey(n));

// ---------------------------------------------------------------- engine
async function cal(year) {
  if (!handles.has(year)) handles.set(year, engine({ op: 'open', year, location: S.home, pack: packJson }).then(r => r.handle));
  return handles.get(year);
}
async function resetCalendars() {
  for (const h of handles.values()) h.then(handle => engine({ op: 'close', handle })).catch(() => {});
  handles.clear();
}
const day = async s => engine({ op: 'day', handle: await cal(+s.slice(0, 4)), date: s });
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
  return all.filter(p => p.name.toLowerCase().startsWith(q) || p.ascii.startsWith(q) || p.alts.split('|').some(a => a.startsWith(q))).slice(0, 20);
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
  $('#tabs').innerHTML = TABS.map(([id, k]) => `<button data-tab="${id}" class="${id === tab ? 'on' : ''}">${esc(t(k))}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.tab; if (tab === 'today') dayDate = null; render(); });
  $('#foot').textContent = t('s.attribution');
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
    if (tab === 'today') return await viewDay();
    if (tab === 'calendar') return await viewMonth();
    if (tab === 'festivals') return await viewFestivals();
    if (tab === 'muhurtham') return viewMuhurtham();
    if (tab === 'birthstar') return viewBirthStar();
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

// ---------------------------------------------------------------- today / day
async function viewDay() {
  const d = dayDate || today();
  loading();
  const p = await day(d);
  const prev = await day(addDays(d, -1)).catch(() => null);
  const parana = prev && prev.occurrences.some(o => o.id === 'ekadashi') ? await engine({ op: 'parana', handle: await cal(+addDays(d, -1).slice(0, 4)), date: addDays(d, -1) }) : null;
  const limb = (list, table) => {
    if (!list?.length) return ['–', ''];
    let detail = t('p.until', clock(list[0].end)); if (list[1]) detail += ' · ' + t('p.then', name(table, list[1].key));
    return [name(table, list[0].key), detail];
  };
  const [tv, td] = limb(p.tithis, 'tithis'), [nv, nd] = limb(p.nakshatras, 'nakshatras'), [yv, yd] = limb(p.yogas, 'yogas'), [kv, kd] = limb(p.karanas, 'karanas');
  const fests = p.occurrences.filter(o => !o.recurring).map(o => ({ o, f: pack.festivals.find(f => f.id === o.id) })).filter(x => x.f && !x.f.hidden);
  const recs = [...new Set(p.occurrences.filter(o => o.recurring && !pack.dailySignificance.find(r => r.key === o.id)?.optIn).map(o => o.id))];
  const people = await peopleOn(d);
  $('#main').innerHTML = `
    <div class="dayhead"><div class="nav"><button class="arrow" data-shift="-1" aria-label="Previous day">‹</button>
      <div><h1 class="serif">${esc(cultureDate(p.solar, p.lunar))}</h1><div class="muted">${esc(greg(d))}</div><div class="small muted">${esc(yearLabel(p.year))}</div>
      <div class="small muted">📍 ${esc(t('f.forPlace', S.home.name))}</div></div>
      <button class="arrow" data-shift="1" aria-label="Next day">›</button></div>
      ${d !== today() ? `<button class="btn soft noprint" data-today>${esc(t('day.jumpToday'))}</button>` : ''}</div>
    ${fests.length || recs.length || people.length ? `<p class="label">${esc(t('day.observances'))}</p>` : ''}
    ${fests.map(({ f, o }) => `<div class="fest ${f.tier === 'major' ? 'major' : ''}" data-f="${esc(f.id)}" data-d="${o.date}"><div class="bar2"></div><div><b>${esc(fname(f))}</b><div class="small muted">${esc(fother(f))}</div><div class="small muted">${esc(text(f.content?.summary))}</div></div><div class="when">›</div></div>`).join('')}
    ${people.map(x => `<div class="rec">🎁 <b>${esc(x.title)}</b> <span class="small muted">${esc(x.line)}</span></div>`).join('')}
    ${recs.map(k => { const r = pack.dailySignificance.find(r => r.key === k); return `<div class="rec">🌙 <b>${esc(recName(k))}</b><div class="small muted">${esc(text(r?.content?.summary))}</div></div>`; }).join('')}
    ${parana ? `<div class="card"><p class="label">${esc(t('v.parana'))}</p><div style="font-size:20px;font-weight:700">${esc(span(parana))}</div>${parana.dvadashiEnd ? `<div class="small muted">${esc(t('v.dvadashiEnds', clock(parana.dvadashiEnd)))}</div>` : ''}<div class="small muted">${esc(t('v.paranaWhy'))}</div></div>` : ''}
    <div class="card"><p class="label">${esc(t('p.panchang'))}</p>
      ${[[t('p.tithi'), (p.lunar ? name('paksha', p.lunar.paksha) + ' ' : '') + tv, td], [t('p.nakshatra'), nv, nd], [t('p.yoga'), yv, yd], [t('p.karana'), kv, kd]]
        .map(([l, v, s]) => `<div class="row"><span class="muted">${esc(l)}</span><span class="v">${esc(v)}<small>${esc(s)}</small></span></div>`).join('')}</div>
    <div class="card sun">${[['sun.sunrise', p.sunrise], ['sun.sunset', p.sunset], ['sun.moonrise', p.moonrise], ['sun.moonset', p.moonset]]
        .map(([k, u]) => `<div><b>${u ? esc(clock(u)) : esc(t('sun.none'))}</b><span class="small muted">${esc(t(k))}</span></div>`).join('')}</div>
    <div class="card"><p class="label">${esc(t('time.section'))}</p><div class="small muted">${esc(t('time.avoid'))}</div>
      ${[['time.rahu', p.rahuKalam], ['time.yama', p.yamagandam], ['time.gulika', p.gulikaKalam]].map(([k, w]) => `<div class="row"><span>${esc(t(k))}</span><span class="v">${esc(span(w))}</span></div>`).join('')}
      <div class="small muted" style="margin-top:8px">${esc(t('time.favoured'))}</div>
      ${[['time.abhijit', p.abhijit], ['time.brahma', p.brahmaMuhurta]].map(([k, w]) => `<div class="row"><span>${esc(t(k))}</span><span class="v">${esc(span(w))}</span></div>`).join('')}</div>
    <button class="btn soft block noprint" onclick="window.print()">🖨 ${esc(t('pdf.share'))}</button>`;
  $('#main').querySelectorAll('[data-shift]').forEach(b => b.onclick = () => { dayDate = addDays(d, +b.dataset.shift); tab = 'today'; viewDay(); });
  $('#main').querySelector('[data-today]')?.addEventListener('click', () => { dayDate = null; viewDay(); });
  wireFestivals();
}
function wireFestivals(root = $('#main')) {
  root.querySelectorAll('[data-f]').forEach(el => el.onclick = () => festivalSheet(el.dataset.f, el.dataset.d));
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
  const cells = await engine({ op: 'month', handle: await cal(y), from: m, to: last });
  const solar = pack.display.primary === 'solar';
  const head = [...new Set(cells.map(c => solar ? name('solarMonths', c.solar?.month) : (c.lunar?.adhika ? name('adhika', 'adhika') + ' ' : '') + name('lunarMonths', c.lunar?.month)))].join(' – ');
  const wd = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(k => {
    const n = name('weekdays', k); if (lang() === 'en') return n.slice(0, 3);
    for (const s of ['వారం', 'ವಾರ', 'वार', 'கிழமை', 'ആഴ്ച']) if (n.endsWith(s) && n.length > s.length) return n.slice(0, -s.length);
    return n;
  });
  const lead = parse(m).getUTCDay(), td = today();
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
      <div><h1 class="serif" style="font-size:24px">${esc(head)}</h1><div class="muted">${esc(new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(m)))}</div></div>
      <button class="arrow" data-m="1">›</button></div></div>
    <div class="grid">${wd.map(w => `<div class="wd">${esc(w)}</div>`).join('')}${'<div class="cell empty"></div>'.repeat(lead)}${grid}</div>
    <p class="small muted" style="margin-top:10px"><span class="dot major"></span> ${esc(t('f.major'))} &nbsp; <span class="dot"></span> ${esc(t('tab.festivals'))} &nbsp; <span class="dot hollow"></span> ${['ekadashi', 'purnima', 'amavasya'].map(k => esc(name('tithis', k))).join(' · ')}</p>
    ${items.length ? `<p class="label" style="margin-top:16px">${esc(t('tab.festivals'))}</p>` : ''}
    ${items.map(x => festRow(x.f, x.date)).join('')}
    <button class="btn soft block noprint" onclick="window.print()">🖨 ${esc(t('pdf.share'))}</button>`;
  $('#main').querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    const d = parse(m); d.setUTCMonth(d.getUTCMonth() + +b.dataset.m, 1); monthDate = ymd(d); viewMonth();
  });
  $('#main').querySelectorAll('[data-day]').forEach(c => c.onclick = () => { dayDate = c.dataset.day; tab = 'today'; render(); });
  wireFestivals();
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
  let html = `<div class="seg noprint" style="margin-bottom:12px"><button data-maj="1" class="${majorOnly ? 'on' : ''}">${esc(t('f.major'))}</button><button data-maj="0" class="${!majorOnly ? 'on' : ''}">${esc(t('f.all'))}</button></div>`;
  let month = '';
  for (const x of list) {
    const mm = x.date.slice(0, 7);
    if (mm !== month) { month = mm; html += `<p class="label" style="margin-top:14px">${esc(new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(x.date)))}</p>`; }
    html += festRow(x.f, x.date);
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
    rows.push(`<div class="list-row"><div class="grow"><b>${esc(t(p.kind === 'remembrance' ? 'pp.remembranceOf' : 'pp.birthdayOf', p.name))}</b> <span class="small muted">${esc(p.sex === 'female' ? t('pp.female') : p.sex === 'male' ? t('pp.male') : '')}</span>
      <div class="small muted">${esc(natalLine(p.anchor))}</div>${next ? `<div class="small" style="color:var(--accent)">${esc(greg(next))}</div>` : ''}</div>
      <button class="btn soft" data-edit="${p.id}">${esc(t('c.edit'))}</button></div>`);
  }
  $('#main').innerHTML = `<div class="card"><p class="label">${esc(t('pp.title'))}</p><p class="small muted">${esc(t('pp.intro'))}</p>${rows.join('') || ''}</div>
    <button class="btn block" data-add>＋ ${esc(t('pp.add'))}</button>`;
  $('#main').querySelector('[data-add]').onclick = () => personEditor(null);
  $('#main').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => personEditor(S.people.find(p => p.id === b.dataset.edit)));
}
function personEditor(person, presetSex, onSaved) {
  const p = Object.assign({ _seq: 0 }, person || { id: crypto.randomUUID(), name: '', sex: presetSex || '', kind: 'birthday', date: '', minutes: null, place: S.home });
  const o = sheet(`<h2 class="serif">${esc(person ? p.name : t('pp.add'))}</h2>
    <label class="field"><span>${esc(t('pp.name'))}</span><input type="text" id="pn" value="${esc(p.name)}"></label>
    <div class="field"><span>${esc(t('pp.sex'))}</span><div class="seg"><button data-sex="female" class="${p.sex === 'female' ? 'on' : ''}">${esc(t('pp.female'))}</button><button data-sex="male" class="${p.sex === 'male' ? 'on' : ''}">${esc(t('pp.male'))}</button></div></div>
    <div class="field"><span>${esc(t('pp.kind'))}</span><div class="seg"><button data-kind="birthday" class="${p.kind !== 'remembrance' ? 'on' : ''}">${esc(t('pp.birthday'))}</button><button data-kind="remembrance" class="${p.kind === 'remembrance' ? 'on' : ''}">${esc(t('pp.remembrance'))}</button></div></div>
    <label class="field"><span>${esc(t('pp.born'))}</span><input type="date" id="pd" min="1900-01-01" max="${today()}" value="${esc(p.date)}"></label>
    <label class="field"><span>${esc(t('pp.time'))}</span><input type="time" id="pt" value="${p.minutes != null ? pad(Math.floor(p.minutes / 60)) + ':' + pad(p.minutes % 60) : ''}"></label>
    <div class="field"><span>${esc(t('pp.place'))}: <b id="pplace">${esc(p.place?.name || '')}</b></span><div id="ppick"></div></div>
    <div class="card" id="preview"></div>
    <div class="small muted">${esc(t('pp.timeNote'))}</div>
    <button class="btn block" id="psave" style="margin-top:12px">${esc(t('c.save'))}</button>
    ${person ? `<button class="btn soft block" id="pdel" style="margin-top:8px">${esc(t('pp.delete'))}</button>` : ''}`, o2 => {
      const q = s => o2.querySelector(s);
      const preview = async () => {
        const d = q('#pd').value; if (!d || !p.place) { q('#preview').innerHTML = `<span class="small muted">${esc(t('bs.choosePlace'))}</span>`; return; }
        q('#preview').innerHTML = '…';
        const tm = q('#pt').value; const minutes = tm ? +tm.slice(0, 2) * 60 + +tm.slice(3) : null;
        const mine = ++p._seq;
        try { const a = await anchorFor(d, minutes, p.place); if (mine !== p._seq) return; p._anchor = a; p._minutes = minutes; q('#preview').innerHTML = anchorCard(a); }
        catch (e) { if (mine === p._seq) q('#preview').textContent = t('pp.failed'); }
      };
      o2.querySelectorAll('[data-sex]').forEach(b => b.onclick = () => { p.sex = b.dataset.sex; o2.querySelectorAll('[data-sex]').forEach(x => x.classList.toggle('on', x === b)); });
      o2.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { p.kind = b.dataset.kind; o2.querySelectorAll('[data-kind]').forEach(x => x.classList.toggle('on', x === b)); });
      q('#pd').onchange = preview; q('#pt').onchange = preview;
      placePicker(q('#ppick'), pl => { p.place = pl; q('#pplace').textContent = pl.name; q('#ppick').querySelector('.results').innerHTML = ''; preview(); });
      if (p.date) preview();
      q('#psave').onclick = async () => {
        p.name = q('#pn').value.trim(); p.date = q('#pd').value;
        if (!p.name || !p.date || !p.sex || !p.place) return alert(`${t('pp.name')}, ${t('pp.sex')}, ${t('pp.born')}, ${t('pp.place')}`);
        await preview(); if (!p._anchor) return;
        const rec = { id: p.id, name: p.name, sex: p.sex, kind: p.kind, date: p.date, minutes: p._minutes ?? null, place: p.place, anchor: p._anchor };
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
  const opt = (list, sel, none) => `${none ? `<option value="">${esc(none)}</option>` : `<option value="">${esc(t('m.choose'))}</option>`}` + list.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('') + `<option value="+">＋ ${esc(t('m.addProfile'))}</option>`;
  const bride = births.find(p => p.id === M.bride), groom = births.find(p => p.id === M.groom);
  const ready = !couple || (bride && groom);
  $('#main').innerHTML = `<p class="muted">${esc(t('m.intro'))}</p>
    <div class="chips">${events.map(e => `<button class="chip ${M.event === e.id ? 'on' : ''}" data-ev="${e.id}">${esc(e.names[lang()] ?? e.names.en)}</button>`).join('')}</div>
    <div class="card" style="margin-top:12px"><p class="label">${esc(t('m.when'))}</p><div class="seg">${[3, 6, 12].map(n => `<button data-mo="${n}" class="${M.months === n ? 'on' : ''}">${esc(t('m.months', n))}</button>`).join('')}</div></div>
    <div class="card"><p class="label">${esc(t(couple ? 'm.couple' : 'm.forWhom'))}</p><p class="small muted">${esc(t('m.jathakamNote'))}</p>
      ${couple ? `<label class="field"><span>${esc(t('m.bride'))}</span><select id="sb">${opt(births.filter(p => p.sex === 'female'), M.bride)}</select><div class="small muted">${esc(natalLine(bride?.anchor))}</div></label>
        <label class="field"><span>${esc(t('m.groom'))}</span><select id="sg">${opt(births.filter(p => p.sex === 'male'), M.groom)}</select><div class="small muted">${esc(natalLine(groom?.anchor))}</div></label>
        ${!ready ? `<div class="small" style="color:var(--accent)">${esc(t('m.needCouple'))}</div>` : `<button class="btn soft block" id="por">💞 ${esc(t('pr.open'))}</button>`}`
      : `<label class="field"><span>${esc(t('m.profile'))}</span><select id="sp">${opt(births, M.profile, t('m.nobody'))}</select></label>`}
      ${[bride, groom].concat(couple ? [] : [births.find(p => p.id === M.profile)]).filter(p => p && !p.anchor?.lagna).map(p => `<div class="small" style="color:var(--accent)">${esc(t('m.noTime', p.name))}</div>`).join('')}
    </div>
    <button class="btn block" id="find" ${ready ? '' : 'disabled'}>${esc(t('m.find'))}</button>
    <div id="mres" style="margin-top:14px"></div>
    <p class="small muted">${esc(t('m.lagna'))}</p>`;
  $('#main').querySelectorAll('[data-ev]').forEach(b => b.onclick = () => { M.event = b.dataset.ev; M.results = null; viewMuhurtham(); });
  $('#main').querySelectorAll('[data-mo]').forEach(b => b.onclick = () => { M.months = +b.dataset.mo; M.results = null; viewMuhurtham(); });
  const pick = (sel, key, sex) => sel && (sel.onchange = () => {
    if (sel.value === '+') personEditor(null, sex, rec => { M[key] = rec.id; M.results = null; viewMuhurtham(); });
    else { M[key] = sel.value; M.results = null; viewMuhurtham(); }
  });
  pick($('#sb'), 'bride', 'female'); pick($('#sg'), 'groom', 'male'); pick($('#sp'), 'profile', '');
  $('#por')?.addEventListener('click', () => poruthamSheet(bride, groom));
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
  const shown = M.byDate ? [...list].sort((a, b) => a.date < b.date ? -1 : 1) : list;
  $('#mres').innerHTML = !list.length ? `<div class="card muted">${esc(t('m.none'))}</div>` : `
    <div class="seg noprint" style="margin-bottom:8px"><button data-bd="0" class="${!M.byDate ? 'on' : ''}">${esc(t('m.best'))}</button><button data-bd="1" class="${M.byDate ? 'on' : ''}">${esc(t('m.byDate'))}</button></div>
    <p class="small muted">${esc(t('m.found', list.length))}</p>
    <button class="btn soft block noprint" onclick="window.print()" style="margin-bottom:10px">🖨 ${esc(t('pdf.share'))}</button>
    ${shown.map(m => `<div class="card"><div style="display:flex;justify-content:space-between"><b>${esc(greg(m.date))}</b><span class="small muted">${esc(t('day.inDays', daysBetween(today(), m.date)))}</span></div>
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
    <div class="card"><p class="label">${esc(t('s.about'))}</p><p class="small">${esc(t('ab.what'))}</p><p class="small">${esc(t('s.privacy'))}</p>
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
