// Family, phase 1 (scratchpad family-spec.md, the approved family-prototype.html): the family's own way of keeping
// each festival, grandparents' voices, festival memories, the kuladevata and native temple, and a family clock.
// Everything stays in this browser: the text in S.family (inside localStorage['kaal-web'], so in the backup file),
// photos and recordings in IndexedDB 'kaal-family' (not in the backup file). Records are shaped for phase 2:
// a UUID, an author {id, name}, created and modified, and deletions kept as tombstones.
// app.js hands over its helpers once (initFamily), as it does for the games.

let X = null;
export const FAM = { screen: 'hub', arg: null, pendingWay: null };
export function initFamily(ctx) { X = ctx; X.onRestart(() => OH.clear()); }
const t = (k, ...a) => X.t(k, ...a);
// The tradition's own word for the family deity: Kuladeivam, Paradevata, Mane devaru, Kuldevi...
export const kulaTerm = () => { const k = 'kula.term.' + X.S.culture, s = X.t(k); return s !== k ? s : t('kula.term.default'); };
const esc = s => X.esc(s);

// ---------------------------------------------------------------- the document
const nowISO = () => new Date().toISOString();
const uuid = () => crypto.randomUUID().toLowerCase();
const LIMIT = { steps: 40, recipes: 20, recipeSteps: 30, buy: 60, photos: 12, cities: 4, text: 300, recipeText: 600 };
export function doc() {
  const S = X.S;
  if (!S.family || typeof S.family !== 'object') S.family = {};
  const F = S.family;
  F.v ??= 1;
  if (!F.me?.id) F.me = { id: uuid(), name: F.me?.name || '' };
  F.ways ??= []; F.voices ??= []; F.cities ??= []; F.gone ??= [];
  if (F.kula === undefined) F.kula = null;
  if (F.second === undefined) F.second = null;
  // A second tradition is never the user's own.
  if (F.second && F.second.culture === S.culture) F.second = null;
  return F;
}
const selfName = () => X.S.people.find(p => p.relation === 'self')?.name || '';
const meName = () => doc().me.name || selfName() || t('fam.hub.meDefault');
const author = () => ({ id: doc().me.id, name: meName() });
const rec = extra => { const n = nowISO(); return { id: uuid(), ...extra, author: author(), created: n, modified: n }; };
const touch = r => { r.modified = nowISO(); return r; };
const tomb = id => { const F = doc(); F.gone.push(id); if (F.gone.length > 500) F.gone = F.gone.slice(-500); };
// Saved with the rest of the app's state; a full localStorage says so.
function persist() { const ok = X.saveOk(); if (!ok) X.toast(t('fam.err.saveWeb')); return ok; }

// The avatar colour: the same hash on every platform (h*31 + charCode, unsigned 32-bit) over the prototype's four
// extra colours and the app's own five.
const PAL = ['#2F7F8A', '#8A5A2F', '#5A4FA8', '#A04A6A', 'var(--fm-clay)', 'var(--fm-green)', 'var(--fm-maroon)', 'var(--fm-indigo-ink)', 'var(--fm-gold-ink)'];
export function colour(name) { let h = 0; const s = String(name || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return PAL[h % PAL.length]; }
const initial = n => ([...String(n || '?').trim()][0] || '?').toUpperCase();
const avatar = (n, small) => `<span class="fm-av${small ? ' s' : ''}" style="background:${colour(n)}" aria-hidden="true">${esc(initial(n))}</span>`;
const tag = n => `<span class="fm-tag" style="background:${colour(n)}">${esc(n)}</span>`;
const dur = s => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const shortDate = s => X.dtf({ weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(X.parse(s));
const abbrev = iso => X.dtf({ day: 'numeric', month: 'short', year: 'numeric', timeZone: X.S.home?.tz }).format(new Date(iso));
const civilOf = (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
function ago(iso) {
  const d = new Date(iso), n = X.daysBetween(civilOf(d, X.S.home?.tz), X.today());
  if (n <= 0) return Date.now() - d < 3600e3 ? t('fam.time.now') : t('day.today');
  if (n === 1) return t('fam.time.yesterday');
  if (n < 6) return t('fam.time.daysAgo', n);
  return abbrev(iso);
}
const when = s => { const n = X.daysBetween(X.today(), s); return n === 0 ? t('day.today') : n === 1 ? t('day.tomorrow') : t('day.inDays', n); };
const cultureName = c => { const x = X.CULTURES.find(y => y.id === c); return x ? (X.S.native ? x.native : x.en) : c; };
const sw = (on, id, labelId) => `<button class="fm-sw" role="switch" aria-checked="${!!on}" ${id ? `id="${id}"` : ''} ${labelId ? `aria-labelledby="${labelId}"` : ''}></button>`;
function confirmSheet(title, body, ok, fn) {
  const o = X.sheet(`<h2 class="serif">${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ''}
    <div class="fm-btns"><button class="btn soft" data-no>${esc(t('c.cancel'))}</button><button class="btn" data-yes>${esc(ok)}</button></div>`);
  o.querySelector('[data-no]').onclick = () => o.remove();
  o.querySelector('[data-yes]').onclick = () => { o.remove(); fn(); };
}
async function shareText(text, title) {
  try { if (navigator.share) return await navigator.share({ title, text }); } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); X.toast('✓ ' + title); } catch { X.download('eka-panchang.txt', text, 'text/plain'); }
}
async function shareFiles(files, text, title) {
  try { if (navigator.canShare?.({ files })) return await navigator.share({ files, text, title }); } catch (e) { if (e?.name === 'AbortError') return; }
  files.forEach((f, i) => setTimeout(() => X.download(f.name, f, f.type), i * 400));
}
const ICON = {
  list: '<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true"><path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M10 6.5h8M10 12.5h8M10 18h8M5 18h1" fill="none" stroke="var(--fm-gold-ink)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mic: '<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true"><rect x="8" y="2.5" width="6" height="11" rx="3" fill="var(--fm-clay)"/><path d="M5 11a6 6 0 0 0 12 0M11 17v3" fill="none" stroke="var(--fm-clay)" stroke-width="1.7" stroke-linecap="round"/></svg>',
  photo: '<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true"><rect x="2.5" y="4" width="17" height="14" rx="3" fill="none" stroke="var(--fm-indigo-ink)" stroke-width="1.6"/><path d="M4 16l4.5-5 3.5 3.5 2.5-2.5L18 16" fill="none" stroke="var(--fm-indigo-ink)" stroke-width="1.6" stroke-linejoin="round"/><circle cx="15" cy="8" r="1.6" fill="var(--fm-indigo-ink)"/></svg>',
  temple: '<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true"><path d="M11 2l2 3h-4zM7.5 6h7l1 4h-9zM5.5 10h11l1 4h-13zM4 14h14v6H4z" fill="none" stroke="var(--fm-maroon)" stroke-width="1.5" stroke-linejoin="round"/><path d="M9.5 20v-3.5a1.5 1.5 0 0 1 3 0V20" fill="none" stroke="var(--fm-maroon)" stroke-width="1.5"/></svg>',
  clock: '<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true"><circle cx="11" cy="11" r="8.5" fill="none" stroke="var(--fm-bengal)" stroke-width="1.6"/><path d="M11 6v5l3.5 2" fill="none" stroke="var(--fm-bengal)" stroke-width="1.7" stroke-linecap="round"/></svg>',
  circle: '<svg viewBox="0 0 22 22" width="26" height="26" aria-hidden="true"><circle cx="11" cy="11" r="8" fill="none" stroke="var(--fm-green)" stroke-width="1.5" stroke-dasharray="2 2.5"/><circle cx="11" cy="3.5" r="2.6" fill="var(--fm-green)"/><circle cx="4.5" cy="15" r="2.6" fill="var(--fm-green)"/><circle cx="17.5" cy="15" r="2.6" fill="var(--fm-green)"/></svg>',
  again: '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" style="flex:none"><path d="M16 10a6 6 0 1 1-1.8-4.3M16 3v3.5h-3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  shield: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" style="flex:none;margin-top:2px"><path d="M8 1.5 2.5 3.8v3.7c0 3.4 2.3 6 5.5 7 3.2-1 5.5-3.6 5.5-7V3.8z" fill="none" stroke="var(--fm-green)" stroke-width="1.5"/></svg>',
  play: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="#fff"/></svg>',
  pause: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="#fff"/><rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="#fff"/></svg>',
};
const back = () => `<button class="linkbtn fm-back" data-fback>‹ ${esc(t('fam.hub.title'))}</button>`;

// ---------------------------------------------------------------- media (IndexedDB)
let dbP = null, persisted = false;
const mediaDb = () => dbP ??= new Promise((res, rej) => {
  try {
    const r = indexedDB.open('kaal-family', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('media'); r.result.createObjectStore('thumbs'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked'));
  } catch (e) { rej(e); }
});
const idb = (store, mode, fn) => mediaDb().then(d => new Promise((res, rej) => {
  const tx = d.transaction(store, mode), q = fn(tx.objectStore(store));
  tx.oncomplete = () => res(q?.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('abort'));
}));
const mediaGet = (store, id) => idb(store, 'readonly', s => s.get(id)).catch(() => null);
async function mediaPut(store, id, val) {
  if (!persisted) { persisted = true; navigator.storage?.persist?.().catch(() => {}); }
  return idb(store, 'readwrite', s => s.put(val, id));
}
const mediaDel = id => Promise.all(['media', 'thumbs'].map(s => idb(s, 'readwrite', st => st.delete(id)).catch(() => {})));
const URLS = new Map();
async function mediaURL(store, id) {
  const k = store + id; if (URLS.has(k)) return URLS.get(k);
  const v = await mediaGet(store, id); if (!v?.blob) return null;
  const u = URL.createObjectURL(v.blob); URLS.set(k, u); return u;
}
// A photo as the phone keeps it: long edge at most 2048 px, JPEG at .82, the right way up, and a 400 px thumbnail.
async function shrink(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const out = async max => {
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    return { blob: await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('encode')), 'image/jpeg', .82)), w, h };
  };
  const full = await out(2048), thumb = await out(400); bmp.close?.();
  return { full, thumb };
}
async function savePhoto(id, file) {
  const { full, thumb } = await shrink(file);
  const created = nowISO();
  await mediaPut('media', id, { blob: full.blob, type: 'image/jpeg', w: full.w, h: full.h, created });
  await mediaPut('thumbs', id, { blob: thumb.blob, type: 'image/jpeg', w: thumb.w, h: thumb.h, created });
  return { w: full.w, h: full.h };
}
// Fills [data-thumb] elements with their photo, or the "on another device" placeholder.
function fillThumbs(root) {
  root.querySelectorAll('[data-thumb]').forEach(async el => {
    const u = await mediaURL('thumbs', el.dataset.thumb);
    if (u) { el.style.backgroundImage = `url("${u}")`; el.classList.add('has'); }
    else { el.classList.add('gone'); el.title = t('fam.way.photoElsewhere'); }
  });
}

// ---------------------------------------------------------------- festivals and occurrences
const OCC = new Map();
// The current occurrence: the first in the home calendar, this year and next, still showing for a week after it ends.
export async function currentOcc(id) {
  const f = X.festById(id); if (!f) return null;
  const td = X.today(), key = `${X.S.culture}|${X.S.home.id}|${td}|${id}`;
  if (OCC.has(key)) return OCC.get(key);
  const y = +td.slice(0, 4), d = (f.durationDays || 1) - 1 + 7;
  let out = null;
  for (const yy of [y, y + 1]) {
    const ds = (await X.festsAt(yy, X.S.home).catch(() => [])).filter(o => o.id === id).map(o => o.date).sort();
    out = ds.find(s => X.addDays(s, d) >= td) || null; if (out) break;
  }
  OCC.set(key, out); return out;
}
const isDone = (item, occ) => !!(item.doneFor && occ && Math.abs(X.daysBetween(item.doneFor, occ)) <= 3);
const wayFor = id => doc().ways.find(w => w.festivalId === id);
const wayName = w => { const f = X.festById(w.festivalId); return f ? X.fname(f) : w.name; };
function ensureWay(f) {
  let w = wayFor(f.id); if (w) return w;
  const n = nowISO();
  w = rec({ festivalId: f.id, culture: X.S.culture, name: X.fname(f), steps: [], recipes: [], buy: [], remind: { on: false, days: 3, modified: n }, photos: [] });
  doc().ways.push(w); return w;
}
const sorted = xs => xs.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

// ---------------------------------------------------------------- Home's tile
// The detail: the next major festival's name when the family has a way for it; the back: the next festival with a way.
export function homeTile(coming, whenFn) {
  const F = doc(), has = id => F.ways.some(w => w.festivalId === id && (w.steps.length || w.recipes.length || w.buy.length));
  const major = coming.find(x => x.f.tier === 'major'), withWay = coming.find(x => has(x.f.id));
  return { detail: major && has(major.f.id) ? `${X.fname(major.f)} · ${whenFn(major.date)}` : t('fam.hub.tileDetail'),
    back: withWay && { caption: t('tb.next'), fact: X.fname(withWay.f), line: `${whenFn(withWay.date)} · ${shortDate(withWay.date)}` } };
}

// ---------------------------------------------------------------- routes
const SCREENS = ['hub', 'ways', 'voices', 'mem', 'kula', 'clock'];
// #family, #family/way/<festivalId>, #family/kula, #family/clock, #family/voices, #family/ways, #family/memories/<id>.
export function famRoute(hash) {
  const m = String(hash || '').replace(/^#/, '').split('/');
  if (m[0] !== 'family') return false;
  FAM.screen = 'hub'; FAM.arg = null; FAM.pendingWay = null;
  if (m[1] === 'way' && m[2]) FAM.pendingWay = decodeURIComponent(m[2]);
  else if (m[1] === 'memories') { FAM.screen = 'mem'; FAM.arg = m[2] ? decodeURIComponent(m[2]) : null; }
  else if (SCREENS.includes(m[1])) FAM.screen = m[1];
  return true;
}
function setHash() {
  const h = '#family' + (FAM.screen === 'hub' ? '' : FAM.screen === 'mem' ? '/memories' + (FAM.arg ? '/' + encodeURIComponent(FAM.arg) : '') : '/' + FAM.screen);
  if (location.hash !== h) history.replaceState(null, '', h);
}
function go(screen, arg = null) { FAM.screen = screen; FAM.arg = arg; X.go('family'); scrollTo(0, 0); }
// Leaving a screen pauses the voice playing and stops a take being recorded.
export function famLeave() {
  stopAudio(); REC.stop?.('leave');
  if (X.tab() !== 'family' && location.hash.startsWith('#family')) history.replaceState(null, '', location.pathname + location.search);
}
export async function viewFamily(main) {
  doc(); setHash();
  const wire = () => main.querySelectorAll('[data-fback]').forEach(b => b.onclick = () => go('hub'));
  const s = FAM.screen;
  if (s === 'ways') await viewWays(main);
  else if (s === 'voices') await viewVoices(main);
  else if (s === 'mem') await viewMem(main);
  else if (s === 'kula') await viewKula(main);
  else if (s === 'clock') await viewClock(main);
  else await viewHub(main);
  wire();
  if (FAM.pendingWay) { const id = FAM.pendingWay; FAM.pendingWay = null; openWay(id); }
}
// A festival page opened at the family's section: the current occurrence, else the next one.
async function openWay(id) {
  const f = X.festById(id);
  if (!f) { const w = wayFor(id); if (w) readOnlyWay(w); return; }
  const d = await currentOcc(id) || (await X.upcoming(X.today(), 400)).find(x => x.f.id === id)?.date;
  if (d) X.festivalSheet(id, d, { family: true });
}

// ---------------------------------------------------------------- hub
async function viewHub(main) {
  X.loading();
  const td = X.today();
  const [coming] = await Promise.all([X.upcoming(td, 60).catch(() => []), X.loadPrayers().catch(() => null)]);
  if (X.tab() !== 'family' || FAM.screen !== 'hub') return;
  const F = doc(), nx = coming.find(x => x.f.tier === 'major');
  const hero = nx ? `<div class="fm-hero rise" style="--i:0"><span class="fm-emb" aria-hidden="true"><i style="-webkit-mask-image:url(emblems/${esc(nx.f.card || 'lotus')}.svg);mask-image:url(emblems/${esc(nx.f.card || 'lotus')}.svg)"></i></span>
      <div class="fm-herotx"><span class="fm-eyebrow">${esc(t('fam.hub.next', when(nx.date)))}</span><h3 class="serif">${esc(X.fname(nx.f))}</h3>${X.fother(nx.f) ? `<span class="fm-other" lang="${esc(X.lang() === 'en' ? X.pack().language : 'en')}">${esc(X.fother(nx.f))}</span>` : ''}
      <span class="fm-when">${esc(shortDate(nx.date))} · ${esc(X.S.home.name)}</span><button class="fm-pill gold" data-openway="${esc(nx.f.id)}" data-d="${nx.date}">${esc(t('fam.hub.openWay'))}</button></div></div>` : '';
  const items = feed();
  const feats = [['ways', 'list', 'gold', 'fam.hub.f.way'], ['voices', 'mic', 'clay', 'fam.hub.f.voice'], ['mem', 'photo', 'indigo', 'fam.hub.f.mem'], ['kula', 'temple', 'maroon', 'fam.hub.f.kula'], ['clock', 'clock', 'bengal', 'fam.hub.f.clock']];
  const fname0 = F.familyName ?? ((X.S.families || [])[0]?.name && ![X.t('fam.default'), X.tIn('en', 'fam.default')].includes(X.S.families[0].name) ? X.S.families[0].name : '');
  main.innerHTML = `<div class="fm">
    <div class="fm-title">${F.familyName ? `<span class="fm-eyebrow clay">${esc(F.familyName)}</span>` : ''}<span class="small muted">${esc(t('fam.hub.eyebrow'))}</span><h2 class="serif">${esc(t('fam.hub.title'))}</h2></div>
    ${hero}
    <section class="fm-sec"><span class="fm-sec-h serif">${esc(t('fam.hub.lately'))}</span>
      ${items.length ? `<div class="card fm-feed">${items.map(x => `<div class="fm-feed-it">${avatar(x.who, true)}<span class="tx">${esc(x.text)}<br><span class="tm">${esc(ago(x.at))}</span></span></div>`).join('')}</div>`
        : `<p class="small muted">${esc(t('fam.hub.empty'))}</p>`}</section>
    <section class="fm-sec"><span class="fm-sec-h serif">${esc(t('fam.hub.features'))}</span>
      <div class="fm-feats">${feats.map(([s, ic, tint, k], i) => `<button class="fm-feat rise" style="--i:${i + 1}" data-fgo="${s}"><span class="fm-ic ${tint}">${ICON[ic]}</span><b>${esc(s === 'kula' ? kulaTerm() : t(k))}</b><span class="d">${esc(t(k + 'D'))}</span></button>`).join('')}</div></section>
    <div class="card fm-circle" role="group" aria-label="${esc(t('fam.circle.title'))}"><span class="fm-ic green">${ICON.circle}</span><div><div class="fm-circlehead"><b>${esc(t('fam.circle.title'))}</b><span class="fm-soon">${esc(t('fam.circle.soon'))}</span></div><p class="small muted">${esc(t('fam.circle.body'))}</p></div></div>
    <div class="card"><label class="field" style="margin-top:0"><span>${esc(t('fam.hub.me'))}</span><input type="text" id="fmme" maxlength="40" value="${esc(meName())}"></label>
      <p class="small muted" style="margin:-4px 0 8px">${esc(t('fam.hub.meNote'))}</p>
      <label class="field"><span>${esc(t('fam.hub.familyName'))}</span><input type="text" id="fmfam" maxlength="60" placeholder="${esc(t('fam.hub.familyNameHint'))}" value="${esc(fname0)}"></label></div>
    <div class="fm-privacy">${ICON.shield}<span><b>${esc(t('fam.privacy.web'))}</b> ${esc(t('fam.privacy.webMedia'))}</span></div></div>`;
  main.querySelectorAll('[data-fgo]').forEach(b => b.onclick = async () => {
    if (b.dataset.fgo === 'mem') return go('mem', await defaultMemFest());
    go(b.dataset.fgo);
  });
  main.querySelector('[data-openway]')?.addEventListener('click', e => X.festivalSheet(e.currentTarget.dataset.openway, e.currentTarget.dataset.d, { family: true }));
  main.querySelector('#fmme').onchange = e => { doc().me.name = e.target.value.trim(); persist(); };
  main.querySelector('#fmfam').onchange = e => { doc().familyName = e.target.value.trim(); persist(); viewHub(main); };
}
// The five most recent changes in the book.
function feed() {
  const F = doc(), out = [], who = r => r.author?.name || meName();
  // This browser's own additions read "You".
  const by = r => (r.author?.id && r.author.id === F.me.id) ? t('gm.you') : who(r);
  for (const w of F.ways) {
    const nm = wayName(w);
    for (const s of w.steps) out.push({ at: s.modified, who: who(s), text: t('fam.feed.step', by(s), s.text, nm) });
    for (const r of w.recipes) out.push({ at: r.modified, who: who(r), text: t('fam.feed.recipe', by(r), r.title) });
    const ph = w.photos.slice().sort((a, b) => a.modified < b.modified ? 1 : -1)[0];
    if (ph) out.push({ at: ph.modified, who: who(ph), text: t('fam.feed.photo', by(ph), nm) });
  }
  for (const v of F.voices) out.push({ at: v.modified, who: v.speaker, text: t('fam.feed.voice', v.speaker, attachTitle(v.attach)) });
  if (F.kula) out.push({ at: F.kula.modified, who: who(F.kula), text: t('fam.feed.kulaT', kulaTerm(), [deityName(F.kula.deity), kulaTempleLabel(F.kula)].filter(Boolean).join(', ')) });
  for (const c of F.cities) out.push({ at: c.modified, who: c.person || who(c), text: t('fam.feed.city', c.person || who(c), c.place?.name || '') });
  return out.filter(x => x.at).sort((a, b) => a.at < b.at ? 1 : -1).slice(0, 5);
}

// ---------------------------------------------------------------- our family's way: the festival page section
export const familyWaySection = () => `<div class="fm-waybox noprint" data-famway></div>`;
export async function wireFamilyWay(root, f, date, opts = {}) {
  const box = root.querySelector('[data-famway]'); if (!box) return;
  await renderWay(box, f, date);
  if (opts.family) box.scrollIntoView({ block: 'start', behavior: X.still() ? 'auto' : 'smooth' });
}
function stepRow(kind, it, occ, ro, fresh) {
  const done = isDone(it, occ), who = it.author?.name || '';
  return `<div class="fm-check${fresh ? ' fresh' : ''}"><input type="checkbox" id="fc-${it.id}" data-tick="${kind}:${it.id}" ${done ? 'checked' : ''} ${ro || !occ ? 'disabled' : ''} aria-label="${esc(it.text + (kind === 'steps' && who ? ', ' + who : ''))}">
    <label for="fc-${it.id}">${esc(it.text)}</label>${kind === 'steps' && who ? tag(who) : ''}${ro ? '' : `<button class="fm-more" data-more="${kind}:${it.id}" aria-label="${esc(t('c.edit'))}: ${esc(it.text)}">⋯</button>`}</div>`;
}
const addRow = (kind, hint) => `<form class="fm-add" data-addform="${kind}"><input type="text" maxlength="${LIMIT.text}" placeholder="${esc(hint)}" aria-label="${esc(hint)}"><button class="btn" type="submit">${esc(t('c.add'))}</button></form>`;
let FRESH = null;
async function renderWay(box, f, date, ro = false) {
  const F = doc(), w = wayFor(f.id), occ = ro ? null : await currentOcc(f.id);
  const p = ro ? null : await X.day(date).catch(() => null);
  const head = `<div class="fm-wayhead"><div><p class="label" style="margin:0">${esc(t('fam.way.title'))}</p>${p ? `<div class="small muted">${esc(X.cultureDate(p.solar, X.keptLunar(f, p.lunar)))}</div>` : ''}</div>
    ${w ? `<button class="btn soft fm-sm" data-wshare>${X.SHARE_ICON} ${esc(t('fam.way.share'))}</button>` : ''}</div>`;
  if (!w || (!w.steps.length && !w.recipes.length && !w.buy.length && !w.photos.length)) {
    box.innerHTML = `${head}<div class="card fm-empty"><b class="serif">${esc(t('fam.way.emptyTitle', X.fname(f)))}</b><p class="small muted">${esc(t('fam.way.emptyBody'))}</p>${addRow('steps', t('fam.way.stepHint'))}</div>
      ${voiceHolder()}${memLink(f)}`;
    wireWay(box, f, date);
    return;
  }
  const steps = sorted(w.steps), buy = sorted(w.buy), doneN = steps.filter(s => isDone(s, occ)).length, left = buy.filter(b => !isDone(b, occ)).length;
  const days = w.remind?.days || 3;
  box.innerHTML = `${head}
    ${ro ? `<p class="small fm-note">${esc(t('fam.way.notThisYear', w.name))}</p>` : ''}
    <section class="fm-sec"><div class="fm-sec-top"><span class="fm-sec-h serif">${esc(t('fam.way.steps'))}</span>${steps.length ? `<span class="small muted">${esc(t('fam.way.stepsDone', doneN, steps.length))}</span>` : ''}</div>
      ${steps.length ? `<div class="card fm-list">${steps.map(s => stepRow('steps', s, occ, ro, FRESH === s.id)).join('')}</div>` : ''}
      ${ro || steps.length >= LIMIT.steps ? '' : addRow('steps', t('fam.way.stepHint'))}</section>
    <section class="fm-sec"><div class="fm-sec-top"><span class="fm-sec-h serif">${esc(t('fam.way.recipes'))}</span></div>
      ${w.recipes.map(r => recipeCard(f, r, ro)).join('')}
      ${ro || w.recipes.length >= LIMIT.recipes ? '' : `<button class="btn soft fm-sm" data-addrecipe>＋ ${esc(t('fam.way.addRecipe'))}</button>`}</section>
    <section class="fm-sec"><div class="fm-sec-top"><span class="fm-sec-h serif">${esc(t('fam.way.buy'))}</span>${buy.length ? `<span class="small muted">${esc(left ? t('fam.way.buyLeft', left) : t('fam.way.buyDone'))}</span>` : ''}</div>
      ${buy.length ? `<div class="card fm-list">${buy.map(b => stepRow('buy', b, occ, ro, FRESH === b.id)).join('')}</div>` : ''}
      ${ro || buy.length >= LIMIT.buy ? '' : addRow('buy', t('fam.way.buyHint'))}</section>
    ${ro ? '' : `<div class="card fm-remind"><label class="fm-inline"><span>${esc(t('fam.way.remindDays'))}</span><select id="fmrdays">${Array.from({ length: 14 }, (_, i) => i + 1).map(n => `<option value="${n}" ${n === days ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <button class="btn soft block" data-fics>🗓 ${esc(t('fam.way.addToCal'))}</button><p class="small muted" style="margin:6px 0 0">${esc(t('fam.way.addToCalNote', days))}</p></div>`}
    <section class="fm-sec"><span class="fm-sec-h serif">${esc(t('fam.way.photos'))}</span>
      <div class="fm-photos">${w.photos.map(ph => `<button class="fm-thumb" data-thumb="${ph.id}" data-ph="${ph.id}" aria-label="${esc(t('fam.way.photos'))}"></button>`).join('')}
      ${!ro && w.photos.length < LIMIT.photos ? `<label class="fm-thumb add"><input type="file" accept="image/*" multiple hidden data-addphotos><span aria-hidden="true">＋</span><span class="small">${esc(t('fam.way.addPhotos'))}</span></label>` : ''}</div>
      ${w.photos.length >= LIMIT.photos ? `<p class="small muted">${esc(t('fam.way.photoLimit', LIMIT.photos))}</p>` : ''}</section>
    ${ro ? '' : voiceHolder()}${ro ? '' : memLink(f)}
    <div class="fm-again">${ICON.again}<span><b>${esc(t('fam.way.again', X.fname(f)))}</b> ${esc(t('fam.way.againBody'))}</span></div>`;
  FRESH = null;
  fillThumbs(box);
  wireWay(box, f, date, ro);
}
const voiceHolder = () => `<div data-fvoicef></div>`;
const memLink = f => `<button class="fm-linkrow" data-memlink="${esc(f.id)}">${ICON.photo}<span class="grow">${esc(t('fam.mem.title'))}</span><span aria-hidden="true">›</span></button>`;
function recipeCard(f, r, ro) {
  const who = r.author?.name || '';
  return `<div class="card fm-recipe"><div class="fm-rtop">${r.photo ? `<span class="fm-ph64" data-thumb="${r.photo}"></span>` : `<span class="fm-ph64 empty" aria-hidden="true"><i style="-webkit-mask-image:url(emblems/${esc(f.card || 'lotus')}.svg);mask-image:url(emblems/${esc(f.card || 'lotus')}.svg)"></i></span>`}
    <div class="tx"><span class="nm serif">${esc(r.title)}</span>${r.meta ? `<span class="small muted">${esc(r.meta)}</span>` : ''}${who ? tag(who) : ''}</div>${ro ? '' : `<button class="fm-more" data-more="recipes:${r.id}" aria-label="${esc(t('c.edit'))}: ${esc(r.title)}">⋯</button>`}</div>
    ${r.steps.length ? `<ol hidden data-rsteps="${r.id}">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <button class="btn soft fm-sm" data-rtoggle="${r.id}" aria-expanded="false">${esc(who ? t('fam.way.showSteps', who) : t('fam.way.showStepsPlain'))}</button>` : ''}</div>`;
}
function wireWay(box, f, date, ro = false) {
  const again = () => renderWay(box, f, date, ro);
  const q = s => box.querySelector(s);
  q('[data-wshare]')?.addEventListener('click', () => { const w = wayFor(f.id); if (w) shareText(wayText(w), t('fam.way.share')); });
  box.querySelectorAll('[data-addform]').forEach(form => form.onsubmit = e => {
    e.preventDefault();
    const inp = form.querySelector('input'), v = inp.value.trim().slice(0, LIMIT.text), kind = form.dataset.addform;
    if (!v) return inp.focus();
    const w = ensureWay(f), list = w[kind];
    if (list.length >= LIMIT[kind]) return;
    const r = rec({ text: v, order: (list.reduce((m, x) => Math.max(m, x.order ?? 0), 0)) + 1, doneFor: null });
    if (kind === 'buy') r.text = v;
    list.push(r); touch(w); FRESH = X.still() ? null : r.id;
    persist(); again().then(() => box.querySelector(`[data-addform="${kind}"] input`)?.focus());
  });
  box.querySelectorAll('[data-tick]').forEach(cb => cb.onchange = async () => {
    const [kind, id] = cb.dataset.tick.split(':'), w = wayFor(f.id), it = w?.[kind].find(x => x.id === id); if (!it) return;
    it.doneFor = cb.checked ? await currentOcc(f.id) : null; touch(it); persist(); again();
  });
  box.querySelectorAll('[data-more]').forEach(b => {
    const open = (x, y) => {
      const [kind, id] = b.dataset.more.split(':'), w = wayFor(f.id); if (!w) return;
      if (kind === 'recipes') {
        const r = w.recipes.find(x => x.id === id); if (!r) return;
        return X.popMenu(x, y, [{ label: t('c.edit'), icon: 'book', fn: () => recipeEditor(f, r, again) },
          { label: t('fam.delete'), icon: 'info', fn: () => confirmSheet(t('fam.way.deleteRecipe', r.title), '', t('fam.delete'), () => {
            w.recipes = w.recipes.filter(x => x.id !== id); tomb(id); if (r.photo) { mediaDel(r.photo); tomb(r.photo); } touch(w); persist(); again(); }) }]);
      }
      const list = sorted(w[kind]), i = list.findIndex(x => x.id === id), it = list[i]; if (!it) return;
      const move = k => { const j = i + k; if (j < 0 || j >= list.length) return;
        const far = list[j + k], near = list[j], edge = far ? far.order : near.order + k;
        it.order = (near.order + edge) / 2; touch(it); persist(); again(); };
      X.popMenu(x, y, [{ label: t('c.edit'), icon: 'book', fn: () => editText(it, kind === 'steps' ? t('fam.way.stepHint') : t('fam.way.buyHint'), () => { touch(it); persist(); again(); }) },
        i > 0 && { label: '↑', icon: 'list', fn: () => move(-1) }, i < list.length - 1 && { label: '↓', icon: 'list', fn: () => move(1) },
        { label: t('fam.delete'), icon: 'info', fn: () => confirmSheet(kind === 'steps' ? t('fam.way.deleteStep') : t('fam.delete'), it.text, t('fam.delete'), () => {
          w[kind] = w[kind].filter(x => x.id !== id); tomb(id); touch(w); persist(); again(); }) }]);
    };
    b.onclick = e => { const r = b.getBoundingClientRect(); open(r.left, r.bottom); e.stopPropagation(); };
    X.onHold(b.closest('.fm-check, .fm-recipe'), (x, y) => open(x, y));
  });
  box.querySelectorAll('[data-rtoggle]').forEach(b => b.onclick = () => {
    const ol = box.querySelector(`[data-rsteps="${b.dataset.rtoggle}"]`), r = wayFor(f.id)?.recipes.find(x => x.id === b.dataset.rtoggle);
    ol.hidden = !ol.hidden; b.setAttribute('aria-expanded', !ol.hidden);
    b.textContent = ol.hidden ? (r?.author?.name ? t('fam.way.showSteps', r.author.name) : t('fam.way.showStepsPlain')) : t('fam.way.hideSteps');
  });
  q('[data-addrecipe]')?.addEventListener('click', () => recipeEditor(f, null, again));
  q('#fmrdays')?.addEventListener('change', e => { const w = ensureWay(f); w.remind = { ...(w.remind || {}), days: +e.target.value, modified: nowISO() }; persist(); again(); });
  q('[data-fics]')?.addEventListener('click', async () => { const w = wayFor(f.id); if (w) familyReminderIcs(f, await currentOcc(f.id) || date, w); });
  q('[data-addphotos]')?.addEventListener('change', async e => {
    const files = [...e.target.files || []]; e.target.value = '';
    const w = ensureWay(f), room = LIMIT.photos - w.photos.length;
    for (const file of files.slice(0, Math.max(0, room))) {
      const id = uuid();
      try { const { w: pw, h } = await savePhoto(id, file); w.photos.push(rec({ id, w: pw, h })); }
      catch (err) { X.toast(err?.message === 'encode' || err?.name === 'InvalidStateError' ? t('fam.err.file') : t('fam.err.saveWeb')); break; }
    }
    touch(w); persist(); again();
  });
  box.querySelectorAll('[data-ph]').forEach(b => b.onclick = () => photoSheet(f, b.dataset.ph, again, ro));
  const vb = q('[data-fvoicef]'); if (vb) voiceBlock(vb, { kind: 'festival', id: f.id });
  q('[data-memlink]')?.addEventListener('click', () => { document.querySelectorAll('.overlay').forEach(o => o.remove()); go('mem', f.id); });
}
function editText(it, hint, done) {
  const o = X.sheet(`<h2 class="serif">${esc(t('c.edit'))}</h2><label class="field"><input type="text" id="fmet" maxlength="${LIMIT.text}" aria-label="${esc(hint)}" value="${esc(it.text)}"></label>
    <div class="fm-btns"><button class="btn soft" data-no>${esc(t('c.cancel'))}</button><button class="btn" data-yes>${esc(t('c.save'))}</button></div>`);
  o.querySelector('[data-no]').onclick = () => o.remove();
  o.querySelector('[data-yes]').onclick = () => { const v = o.querySelector('#fmet').value.trim(); if (!v) return; it.text = v.slice(0, LIMIT.text); o.remove(); done(); };
  setTimeout(() => o.querySelector('#fmet').focus(), 50);
}
function photoSheet(f, id, done, ro) {
  const o = X.sheet(`<div class="fm-full" id="fmfull"><p class="small muted">…</p></div>${ro ? '' : `<button class="btn soft block" data-rm>${esc(t('fam.remove'))}</button>`}`);
  o.classList.add('full');
  mediaURL('media', id).then(u => { const el = o.querySelector('#fmfull'); el.innerHTML = u ? `<img src="${u}" alt="">` : `<p class="muted">${esc(t('fam.way.photoElsewhere'))}</p>`; });
  o.querySelector('[data-rm]')?.addEventListener('click', () => confirmSheet(t('fam.way.deletePhoto'), '', t('fam.remove'), () => {
    const w = wayFor(f.id); if (!w) return; w.photos = w.photos.filter(x => x.id !== id); tomb(id); mediaDel(id); touch(w); persist(); o.remove(); done();
  }));
}
function recipeEditor(f, r0, done) {
  const r = r0 ? { ...r0, steps: [...r0.steps] } : { title: '', meta: '', steps: [''], photo: null };
  if (!r.steps.length) r.steps.push('');
  let photoFile = null;
  const o = X.sheet(`<h2 class="serif">${esc(t('fam.way.editRecipe'))}</h2>
    <label class="field"><span>${esc(t('fam.way.recipeTitle'))}</span><input type="text" id="frt" maxlength="${LIMIT.text}" value="${esc(r.title)}"></label>
    <label class="field"><span>${esc(t('fam.way.recipeMeta'))}</span><input type="text" id="frm" maxlength="${LIMIT.text}" value="${esc(r.meta)}"></label>
    <p class="label">${esc(t('fam.way.recipeSteps'))}</p><div id="frs"></div><button class="linkbtn" data-addrs>＋ ${esc(t('fam.way.addRecipeStep'))}</button>
    <div class="fm-rphoto"><span class="fm-ph64" id="frp" ${r.photo ? `data-thumb="${r.photo}"` : ''}></span><label class="btn soft"><input type="file" accept="image/*" hidden id="frpf"><span id="frpl">${esc(r.photo ? t('fam.way.recipePhotoChange') : t('fam.way.recipePhoto'))}</span></label></div>
    <div class="fm-btns"><button class="btn soft" data-no>${esc(t('c.cancel'))}</button><button class="btn" data-yes>${esc(t('c.save'))}</button></div>`);
  const q = s => o.querySelector(s);
  const read = () => [...o.querySelectorAll('#frs textarea')].forEach((x, i) => { r.steps[i] = x.value; });
  const draw = () => {
    q('#frs').innerHTML = r.steps.map((s, i) => `<label class="field"><span>${esc(t('fam.way.recipeStep', i + 1))}</span><textarea rows="2" maxlength="${LIMIT.recipeText}">${esc(s)}</textarea></label>`).join('');
    q('[data-addrs]').hidden = r.steps.length >= LIMIT.recipeSteps;
  };
  draw(); fillThumbs(o);
  q('[data-addrs]').onclick = () => { read(); r.steps.push(''); draw(); o.querySelector('#frs textarea:last-of-type')?.focus(); };
  q('#frpf').onchange = e => { photoFile = e.target.files?.[0] || null; if (!photoFile) return;
    const el = q('#frp'); el.classList.add('has'); el.style.backgroundImage = `url("${URL.createObjectURL(photoFile)}")`; q('#frpl').textContent = t('fam.way.recipePhotoChange'); };
  q('[data-no]').onclick = () => o.remove();
  q('[data-yes]').onclick = async () => {
    read();
    const title = q('#frt').value.trim(); if (!title) return q('#frt').focus();
    o.dataset.busy = '1';
    const w = ensureWay(f);
    let photo = r.photo || null;
    if (photoFile) {
      const id = uuid();
      try { await savePhoto(id, photoFile); if (photo) { mediaDel(photo); tomb(photo); } photo = id; }
      catch { X.toast(t('fam.err.saveWeb')); }
    }
    const fields = { title: title.slice(0, LIMIT.text), meta: q('#frm').value.trim().slice(0, LIMIT.text), steps: r.steps.map(s => s.trim().slice(0, LIMIT.recipeText)).filter(Boolean).slice(0, LIMIT.recipeSteps), photo };
    if (r0) { Object.assign(r0, fields); touch(r0); } else w.recipes.push(rec(fields));
    touch(w); persist(); delete o.dataset.busy; o.remove(); done();
  };
}
// Our way as plain text: the steps, the recipes with theirs, and the list.
function wayText(w) {
  const L = [t('fam.way.shareHead', wayName(w)), ''];
  sorted(w.steps).forEach((s, i) => L.push(`${i + 1}. ${s.text}`));
  if (w.recipes.length) { L.push('', t('fam.way.recipes') + ':'); for (const r of w.recipes) { L.push(`• ${r.title}${r.meta ? ' (' + r.meta + ')' : ''}`); r.steps.forEach((s, i) => L.push(`   ${i + 1}. ${s}`)); } }
  if (w.buy.length) { L.push('', t('fam.way.buy') + ':'); sorted(w.buy).forEach(b => L.push(`– ${b.text}`)); }
  L.push('', t('fam.way.shareFooter'));
  return L.join('\n');
}
// The web sends no notifications: a calendar file with the festival, our steps and list, and an alarm at 9:00 at home.
export function familyReminderIcs(f, date, w) {
  const days = w.remind?.days || 3, tx = s => String(s || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const st = u => new Date(u * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const alarm = X.zonedUnix(X.addDays(date, -days), '09:00', X.S.home.tz);
  const desc = [t('fam.way.steps') + ':', ...sorted(w.steps).map((s, i) => `${i + 1}. ${s.text}`), '', t('fam.way.buy') + ':', ...sorted(w.buy).map(b => `– ${b.text}`)].join('\n');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Funtopia//Eka Panchang web//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${f.id}-${date}-family@eka-panchang`, 'DTSTAMP:' + st(Date.now() / 1000), 'DTSTART;VALUE=DATE:' + date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + X.addDays(date, 1).replace(/-/g, ''),
    'SUMMARY:' + tx(X.fname(f)), 'DESCRIPTION:' + tx(desc), 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + tx(X.fname(f)), 'TRIGGER;VALUE=DATE-TIME:' + st(alarm), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
  X.download(`${f.id}-family.ics`, L.join('\r\n') + '\r\n', 'text/calendar');
  X.toast(X.t('r3w.downloaded', X.fname(f)));
}
// A way whose festival is not in this tradition: shown as it is, to read and share.
function readOnlyWay(w) {
  const f = { id: w.festivalId, card: 'lotus', names: { en: w.name }, content: {} };
  const o = X.sheet(`<h1 class="serif" style="margin:6px 0 0">${esc(w.name)}</h1><div class="muted">${esc(cultureName(w.culture))}</div>${familyWaySection()}`);
  renderWay(o.querySelector('[data-famway]'), { ...f, names: { en: w.name, [X.lang()]: w.name } }, X.today(), true);
}

// ---------------------------------------------------------------- the way list
async function viewWays(main) {
  X.loading();
  const F = doc(), td = X.today();
  const mine = [], other = [];
  for (const w of F.ways) { const f = X.festById(w.festivalId); if (f) mine.push({ w, f, d: await currentOcc(f.id) }); else other.push(w); }
  mine.sort((a, b) => (a.d || '9') < (b.d || '9') ? -1 : 1);
  const choose = (await X.upcoming(td, 365).catch(() => [])).filter(x => x.f.tier === 'major' && !wayFor(x.f.id));
  const seen = new Set(), chooseU = choose.filter(x => !seen.has(x.f.id) && seen.add(x.f.id));
  if (X.tab() !== 'family' || FAM.screen !== 'ways') return;
  const row = (attrs, title, sub, right) => `<button class="fm-lrow" ${attrs}><span class="grow"><b>${esc(title)}</b>${sub ? `<span class="small muted">${esc(sub)}</span>` : ''}</span>${right ? `<span class="small muted">${esc(right)}</span>` : ''}<span aria-hidden="true">›</span></button>`;
  main.innerHTML = `<div class="fm">${back()}<div class="fm-title"><h2 class="serif">${esc(t('fam.way.title'))}</h2><span class="small muted">${esc(t('fam.hub.f.wayD'))}</span></div>
    ${mine.length ? `<section class="fm-sec"><span class="fm-sec-h serif">${esc(t('fam.way.list'))}</span><div class="card fm-list">${mine.map(({ w, f, d }) => {
      const st = sorted(w.steps), done = st.filter(s => isDone(s, d)).length, left = w.buy.filter(b => !isDone(b, d)).length;
      return row(`data-wf="${esc(f.id)}" data-d="${d || ''}"`, X.fname(f), [d ? shortDate(d) : '', st.length ? t('fam.way.stepsDone', done, st.length) : '', w.buy.length ? (left ? t('fam.way.buyLeft', left) : t('fam.way.buyDone')) : ''].filter(Boolean).join(' · '), '');
    }).join('')}</div></section>` : ''}
    <section class="fm-sec"><span class="fm-sec-h serif">${esc(t('fam.way.choose'))}</span><div class="card fm-list">${chooseU.map(x => row(`data-wf="${esc(x.f.id)}" data-d="${x.date}"`, X.fname(x.f), shortDate(x.date), when(x.date))).join('')}</div></section>
    ${other.length ? `<section class="fm-sec"><span class="fm-sec-h serif">${esc(t('fam.way.otherTradition'))}</span><div class="card fm-list">${other.map(w => row(`data-wo="${esc(w.id)}"`, w.name, cultureName(w.culture), '')).join('')}</div></section>` : ''}</div>`;
  main.querySelectorAll('[data-wf]').forEach(b => b.onclick = () => b.dataset.d ? X.festivalSheet(b.dataset.wf, b.dataset.d, { family: true }) : openWay(b.dataset.wf));
  main.querySelectorAll('[data-wo]').forEach(b => b.onclick = () => readOnlyWay(doc().ways.find(w => w.id === b.dataset.wo)));
}

// ---------------------------------------------------------------- voices
const AU = { el: null, stop: null };
function stopAudio() { const s = AU.stop; AU.stop = null; AU.el?.pause(); AU.el = null; s?.(); }
const REC = { stop: null };
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const unb64 = s => { try { return [...atob(s || '')].map(c => c.charCodeAt(0)); } catch { return []; } };
// 96 buckets, the RMS of each, normalised to the loudest, a floor of 0.08, as bytes.
function peaksOf(samples) {
  const n = 96, out = [], size = Math.max(1, Math.floor(samples.length / n));
  for (let i = 0; i < n; i++) { let s = 0; const a = i * size, b = Math.min(samples.length, a + size); for (let j = a; j < b; j++) s += samples[j] * samples[j]; out.push(Math.sqrt(s / Math.max(1, b - a))); }
  const max = Math.max(...out, 1e-9);
  return out.map(v => Math.round(Math.max(.08, v / max) * 255));
}
const resample = (xs, n) => Array.from({ length: n }, (_, i) => xs.length ? xs[Math.min(xs.length - 1, Math.floor(i * xs.length / n))] : .08);
const bars64 = v => resample(unb64(v.peaks).map(x => x / 255), 64);
const voiceTitle = v => attachTitle(v.attach);
let PRAYERS = null;
function attachTitle(a) {
  if (!a) return '';
  if (a.kind === 'prayer') { const p = PRAYERS?.prayers.find(x => x.id === a.id); return p ? X.prayerTitle(p) : a.id; }
  const f = X.festById(a.id); if (f) return X.fname(f);
  return wayFor(a.id)?.name || a.id;
}
const canPlay = mime => { try { return new Audio().canPlayType(mime) !== ''; } catch { return false; } };
// The voice card: who, when and how long, the waveform, play, and the red button for a new take; a take in
// review is listened to, then kept (whose voice, for what, what it is) or discarded.
function voicePanel(el, opts) {
  let v = opts.voice || null, mode = 'idle', take = null, played = 0, raf = 0;
  const kf = { who: '', person: null, kind: 'prayer', forId: '', about: '' };
  const attach = v?.attach || opts.attach || null;
  const draw = () => {
    const bars = take && (mode === 'review' || mode === 'reviewplay' || mode === 'recording') ? take.bars : v ? bars64(v) : [];
    const total = take && mode !== 'idle' && mode !== 'playing' && mode !== 'paused' ? take.dur : v?.duration || 0;
    const playable = take && (mode === 'review' || mode === 'reviewplay') ? true : v && canPlay(v.mime);
    el.innerHTML = `<div class="fm-voice">
      <div class="fm-vtop">${v ? avatar(v.speaker) : `<span class="fm-ic clay">${ICON.mic}</span>`}<span class="tx">${v ? `<span class="nm serif">${esc(t('fam.voice.nameVoice', v.speaker))}</span><span class="small muted">${esc([t('fam.voice.recorded', abbrev(v.created)), dur(v.duration), v.about].filter(Boolean).join(' · '))}</span>` : `<span class="nm serif">${esc(t('fam.voice.recordNew'))}</span><span class="small muted">${esc(t('fam.voice.maxLength'))}</span>`}</span>
        ${playable || mode === 'recording' ? `<button class="fm-play" data-vplay ${mode === 'recording' ? 'disabled' : ''} aria-label="${esc(mode === 'playing' || mode === 'reviewplay' ? t('fam.voice.pause') : take && mode === 'review' ? t('fam.voice.playTake') : t('fam.voice.play', v?.speaker || ''))}">${mode === 'playing' || mode === 'reviewplay' ? ICON.pause : ICON.play}</button>` : ''}</div>
      ${bars.length || mode === 'recording' ? `<div class="fm-wave${mode === 'recording' ? ' recon' : ''}" aria-hidden="true">${bars.slice(-64).map(h => `<i style="height:${Math.round(6 + h * 38)}px"></i>`).join('')}</div>` : ''}
      ${v && !canPlay(v.mime) && !take ? `<p class="small muted">${esc(t('fam.err.file'))}</p>` : ''}
      <div class="fm-vrow"><span class="fm-timer" data-vtimer>${esc(mode === 'recording' ? '0:00' : played ? `${dur(played)} / ${dur(total)}` : dur(total))}</span><span class="small muted fm-state" data-vstate>${esc(stateText())}</span>
        <button class="fm-rec${mode === 'recording' ? ' on' : ''}" data-vrec ${mode === 'review' || mode === 'reviewplay' ? 'disabled' : ''} aria-label="${esc(mode === 'recording' ? t('fam.voice.stop') : t('fam.voice.record'))}"><i></i></button></div>
      <div data-vkeep ${mode === 'review' || mode === 'reviewplay' ? '' : 'hidden'}></div></div>`;
    el.querySelector('[data-vplay]')?.addEventListener('click', togglePlay);
    el.querySelector('[data-vrec]').onclick = () => mode === 'recording' ? REC.stop?.('stop') : record();
    if (mode === 'review' || mode === 'reviewplay') keepForm(el.querySelector('[data-vkeep]'));
  };
  let note = '';
  const stateText = () => note || (mode === 'recording' ? (opts.speaker ? t('fam.voice.recording', opts.speaker) : t('fam.voice.recordingPlain'))
    : mode === 'review' || mode === 'reviewplay' ? t('fam.voice.review') : mode === 'paused' ? t('fam.voice.paused') : mode === 'ended' ? t('fam.voice.ended') : mode === 'playing' ? '' : t('fam.voice.idle'));
  const say = s => { note = s; const e = el.querySelector('[data-vstate]'); if (e) e.textContent = stateText(); };
  const paint = (p, total) => {
    const bs = el.querySelectorAll('.fm-wave i'), n = Math.round(Math.min(1, p / Math.max(.01, total)) * bs.length);
    bs.forEach((b, i) => b.classList.toggle('on', i < n));
    const tm = el.querySelector('[data-vtimer]'); if (tm) tm.textContent = `${dur(p)} / ${dur(total)}`;
  };
  async function togglePlay() {
    const inReview = !!take && (mode === 'review' || mode === 'reviewplay');
    const total = inReview ? take.dur : v.duration;
    if (mode === 'playing' || mode === 'reviewplay') { cancelAnimationFrame(raf); AU.el?.pause(); mode = inReview ? 'review' : 'paused'; note = ''; draw(); return paint(played, total); }
    const url = inReview ? take.url : await mediaURL('media', v.id);
    if (!url) return say(t('fam.err.file'));
    if (!AU.el || AU.el.dataset.src !== url) {
      stopAudio();
      const a = new Audio(url); a.dataset.src = url; AU.el = a;
      AU.stop = () => { cancelAnimationFrame(raf); if (mode === 'playing' || mode === 'reviewplay') { mode = inReview ? 'review' : 'paused'; if (el.isConnected) draw(); } };
      a.onended = () => { cancelAnimationFrame(raf); played = 0; mode = inReview ? 'review' : 'ended'; note = ''; AU.el = null; AU.stop = null; if (el.isConnected) draw(); };
    }
    if (mode === 'ended' || (!inReview && mode === 'idle')) AU.el.currentTime = 0;
    mode = inReview ? 'reviewplay' : 'playing'; note = ''; draw();
    try { await AU.el.play(); } catch { mode = inReview ? 'review' : 'idle'; draw(); return say(t('fam.err.file')); }
    cancelAnimationFrame(raf);
    const step = () => { if (!el.isConnected) return stopAudio(); if (!AU.el || AU.el.paused) return; played = AU.el.currentTime; paint(played, total); raf = requestAnimationFrame(step); };
    step();
  }
  async function record() {
    stopAudio(); note = '';
    if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) return say(t('fam.perm.micNone'));
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { return say(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? t('fam.perm.micWeb') : t('fam.perm.micNone')); }
    const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus'].find(m => MediaRecorder.isTypeSupported?.(m)) || '';
    let mr; try { mr = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 64000 }); } catch { stream.getTracks().forEach(x => x.stop()); return say(t('fam.perm.micNone')); }
    const ac = new (window.AudioContext || window.webkitAudioContext)(), an = ac.createAnalyser(); an.fftSize = 2048;
    ac.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize), live = [], chunks = [];
    mr.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
    const t0 = performance.now();
    mode = 'recording'; take = { bars: live, dur: 0 }; draw();
    const iv = setInterval(() => {
      if (!el.isConnected) return finish('leave');
      an.getFloatTimeDomainData(buf); let s = 0; for (const x of buf) s += x * x;
      live.push(Math.min(1, Math.sqrt(Math.sqrt(s / buf.length)) * 1.6));
      const secs = (performance.now() - t0) / 1000;
      const w = el.querySelector('.fm-wave'); if (w) w.innerHTML = live.slice(-64).map(h => `<i style="height:${Math.round(6 + h * 38)}px"></i>`).join('');
      const tm = el.querySelector('[data-vtimer]'); if (tm) tm.textContent = dur(secs);
      if (secs >= 600) finish('stop');
    }, 100);
    const onHide = () => { if (document.hidden) finish('interrupted'); };
    document.addEventListener('visibilitychange', onHide);
    stream.getTracks().forEach(tr => tr.onended = () => finish('interrupted'));
    let ended = false;
    async function finish(why) {
      if (ended) return; ended = true; REC.stop = null;
      clearInterval(iv); document.removeEventListener('visibilitychange', onHide);
      const secs = (performance.now() - t0) / 1000;
      await new Promise(res => { mr.onstop = res; try { mr.state !== 'inactive' ? mr.stop() : res(); } catch { res(); } });
      stream.getTracks().forEach(x => x.stop()); ac.close().catch(() => {});
      if (why === 'leave') { take = null; mode = 'idle'; return; }
      if (secs < 1.5) { take = null; mode = 'idle'; note = t('fam.voice.tooShort'); return el.isConnected && draw(); }
      const type = mr.mimeType || mime || 'audio/webm', blob = new Blob(chunks, { type });
      take = { blob, dur: secs, bars: resample(live, 64), live: live.slice(), url: URL.createObjectURL(blob), type };
      mode = 'review'; note = why === 'interrupted' ? t('fam.voice.interrupted') : ''; played = 0;
      if (el.isConnected) draw();
    }
    REC.stop = finish;
    try { mr.start(250); } catch { finish('leave'); say(t('fam.perm.micNone')); }
  }
  async function keepForm(box) {
    const people = X.S.people.map(p => p.name).filter(Boolean);
    const fixed = attach;
    const fests = fixed ? [] : await festivalChoices();
    const prs = fixed ? [] : ((PRAYERS ??= await X.loadPrayers().catch(() => null))?.prayers || []);
    box.innerHTML = `<div class="fm-keep">
      <label class="field"><span>${esc(t('fam.voice.who'))}</span>${people.length ? `<select data-kpp aria-label="${esc(t('fam.voice.fromPeople'))}"><option value="">${esc(t('fam.voice.fromPeople'))}</option>${X.S.people.filter(p => p.name).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>` : ''}
        <input type="text" data-kwho maxlength="40" placeholder="${esc(t('fam.voice.whoHint'))}" aria-label="${esc(t('fam.voice.who'))}" style="margin-top:6px"></label>
      <p class="small fm-warn" data-kneed hidden>${esc(t('fam.voice.whoNeeded'))}</p>
      ${fixed ? `<div class="field"><span>${esc(t('fam.voice.for'))}</span><b>${esc(attachTitle(fixed))}</b></div>`
        : `<div class="field"><span>${esc(t('fam.voice.for'))}</span><div class="seg" data-kkind><button data-kk="prayer" class="on">${esc(t('fam.voice.forPrayer'))}</button><button data-kk="festival">${esc(t('fam.voice.forFestival'))}</button></div>
        <select data-kfor style="margin-top:6px" aria-label="${esc(t('fam.voice.for'))}"></select></div>`}
      <label class="field"><span>${esc(t('fam.voice.about'))}</span><input type="text" data-kabout maxlength="${LIMIT.text}" placeholder="${esc(t('fam.voice.aboutHint'))}"></label>
      <div class="fm-btns"><button class="btn soft" data-kdisc>${esc(t('fam.voice.discard'))}</button><button class="btn" data-kkeep disabled>${esc(t('fam.voice.keep'))}</button></div></div>`;
    const q = s => box.querySelector(s);
    if (!box.isConnected) return;
    const fill = () => { if (fixed) return; const sel = q('[data-kfor]'); sel.innerHTML = (kf.kind === 'prayer' ? prs.map(p => [p.id, X.prayerTitle(p)]) : fests.map(f => [f.id, X.fname(f)])).map(([id, n]) => `<option value="${esc(id)}" ${id === kf.forId ? 'selected' : ''}>${esc(n)}</option>`).join(''); kf.forId = sel.value; };
    box.querySelectorAll('[data-kk]').forEach(b => { b.classList.toggle('on', b.dataset.kk === kf.kind); b.onclick = () => { kf.kind = b.dataset.kk; kf.forId = ''; box.querySelectorAll('[data-kk]').forEach(x => x.classList.toggle('on', x === b)); fill(); }; });
    fill();
    q('[data-kfor]')?.addEventListener('change', e => { kf.forId = e.target.value; });
    q('[data-kwho]').value = kf.who; q('[data-kabout]').value = kf.about; if (q('[data-kpp]')) q('[data-kpp]').value = kf.person || '';
    const check = () => { const ok = !!q('[data-kwho]').value.trim(); q('[data-kkeep]').disabled = !ok; q('[data-kneed]').hidden = ok; };
    q('[data-kpp]')?.addEventListener('change', e => { kf.person = e.target.value || null; const p = X.S.people.find(x => x.id === kf.person); if (p) q('[data-kwho]').value = kf.who = p.name; check(); });
    q('[data-kwho]').oninput = e => { kf.who = e.target.value; kf.person = null; if (q('[data-kpp]')) q('[data-kpp]').value = ''; check(); };
    q('[data-kabout]').oninput = e => { kf.about = e.target.value; };
    check();
    q('[data-kdisc]').onclick = () => confirmSheet(t('fam.voice.discardAsk'), '', t('fam.voice.discard'), () => { stopAudio(); URL.revokeObjectURL(take.url); take = null; mode = 'idle'; note = ''; played = 0; draw(); });
    q('[data-kkeep]').onclick = async () => {
      const speaker = q('[data-kwho]').value.trim(); if (!speaker) return check();
      q('[data-kkeep]').disabled = true; stopAudio();
      const at = fixed || { kind: kf.kind, id: q('[data-kfor]').value };
      let peaks;
      try { const ac = new (window.OfflineAudioContext || window.AudioContext)(1, 44100, 44100); const ab = await ac.decodeAudioData(await take.blob.arrayBuffer()); peaks = peaksOf(ab.getChannelData(0)); if (ab.duration && isFinite(ab.duration)) take.dur = ab.duration; }
      catch { const mx = Math.max(...take.live, 1e-6); peaks = resample(take.live, 96).map(x => Math.round(Math.max(.08, x / mx) * 255)); }
      const base = take.type.split(';')[0], ext = base === 'audio/mp4' ? 'm4a' : base === 'audio/ogg' ? 'ogg' : 'webm';
      const id = uuid();
      try { await mediaPut('media', id, { blob: take.blob, type: base, created: nowISO() }); }
      catch { q('[data-kkeep]').disabled = false; return X.toast(t('fam.voice.storage')); }
      const nv = rec({ id, speaker, speakerPerson: kf.person, attach: at, about: q('[data-kabout]').value.trim().slice(0, LIMIT.text), duration: Math.round(take.dur * 10) / 10, mime: base, ext, peaks: b64(peaks) });
      nv.id = id;
      doc().voices.push(nv); persist();
      URL.revokeObjectURL(take.url); take = null; v = nv; mode = 'idle'; note = ''; played = 0;
      opts.onKept?.(nv) || draw();
    };
  }
  draw();
}
async function festivalChoices() {
  const up = (await X.upcoming(X.today(), 370).catch(() => [])).map(x => x.f), seen = new Set(up.map(f => f.id));
  const rest = X.pack().festivals.filter(f => !f.hidden && !seen.has(f.id)).sort((a, b) => X.fname(a).localeCompare(X.fname(b)));
  const u = []; const s2 = new Set(); for (const f of up) if (!s2.has(f.id)) { s2.add(f.id); u.push(f); }
  return [...u, ...rest];
}
// The recordings for a prayer or a festival: the newest as a card, the rest beneath by voice, and the greeting.
export async function voiceBlock(el, attach) {
  PRAYERS ??= await X.loadPrayers().catch(() => null);
  const draw = (pick) => {
    const vs = doc().voices.filter(v => v.attach?.kind === attach.kind && v.attach?.id === attach.id).sort((a, b) => a.created < b.created ? 1 : -1);
    if (!vs.length) {
      el.innerHTML = `<button class="fm-linkrow" data-rnew>${ICON.mic}<span class="grow">${esc(t('fam.voice.recordNew'))}</span><span aria-hidden="true">›</span></button><div data-panel></div>`;
      el.querySelector('[data-rnew]').onclick = e => { e.currentTarget.hidden = true; voicePanel(el.querySelector('[data-panel]'), { attach, onKept: () => { draw(); return true; } }); };
      return;
    }
    const main = vs.find(v => v.id === pick) || vs[0], others = vs.filter(v => v !== main);
    const groups = [...new Set(others.map(v => v.speaker))];
    el.innerHTML = `${attach.kind === 'festival' ? `<p class="label" style="margin:12px 0 6px">${esc(t('fam.voice.in', main.speaker))}</p>` : ''}<div data-panel></div>
      <div class="fm-vacts"><button class="fm-pill gold" data-greet>${esc(t('fam.voice.greet'))}</button><button class="linkbtn" data-rnew>＋ ${esc(t('fam.voice.recordNew'))}</button></div>
      ${groups.map(s => `<p class="label" style="margin:12px 0 4px">${esc(t('fam.voice.more', s))}</p><div class="fm-plist">${others.filter(v => v.speaker === s).map(v => `<button data-vpick="${v.id}"><span>${esc(v.about || voiceTitle(v))}</span><span class="small muted">${dur(v.duration)}</span></button>`).join('')}</div>`).join('')}`;
    voicePanel(el.querySelector('[data-panel]'), { voice: main, onKept: nv => { draw(nv.id); return true; } });
    el.querySelectorAll('[data-vpick]').forEach(b => b.onclick = () => { stopAudio(); draw(b.dataset.vpick); });
    el.querySelector('[data-greet]').onclick = () => greetSheet(main);
    el.querySelector('[data-rnew]').onclick = () => { stopAudio(); voicePanel(el.querySelector('[data-panel]'), { attach, onKept: nv => { draw(nv.id); return true; } }); };
  };
  draw();
}
async function viewVoices(main) {
  X.loading();
  PRAYERS ??= await X.loadPrayers().catch(() => null);
  if (X.tab() !== 'family' || FAM.screen !== 'voices') return;
  const draw = () => {
    const vs = doc().voices.slice().sort((a, b) => a.created < b.created ? 1 : -1), who = [...new Set(vs.map(v => v.speaker))];
    main.innerHTML = `<div class="fm">${back()}<div class="fm-title"><h2 class="serif">${esc(t('fam.voice.title'))}</h2><span class="small muted">${esc(t('fam.hub.f.voiceD'))}</span></div>
      <button class="btn block" data-vnew>🎙 ${esc(t('fam.voice.recordNew'))}</button><div data-vpanel style="margin-top:12px"></div>
      ${vs.length ? who.map(s => `<section class="fm-sec"><div class="fm-sec-top">${avatar(s, true)}<span class="fm-sec-h serif grow">${esc(t('fam.voice.nameVoice', s))}</span></div><div class="card fm-list">${vs.filter(v => v.speaker === s).map(v => `<div class="fm-vline">
          <button class="fm-mini" data-vplay="${v.id}" aria-label="${esc(t('fam.voice.play', s))}">▶ ${dur(v.duration)}</button>
          <span class="grow"><b>${esc(voiceTitle(v))}</b>${v.about ? `<span class="small muted">${esc(v.about)}</span>` : ''}<span class="small muted">${esc(abbrev(v.created))}</span></span>
          <button class="fm-more" data-vmore="${v.id}" aria-label="${esc(t('fam.delete'))}">⋯</button></div>`).join('')}</div></section>`).join('')
        : `<p class="muted">${esc(t('fam.voice.none'))}</p>`}
      <p class="small muted">${esc(t('fam.privacy.webMedia'))}</p></div>`;
    main.querySelector('[data-fback]').onclick = () => go('hub');
    main.querySelector('[data-vnew]').onclick = () => voicePanel(main.querySelector('[data-vpanel]'), { onKept: () => { draw(); return true; } });
    main.querySelectorAll('[data-vplay]').forEach(b => b.onclick = () => { const v = doc().voices.find(x => x.id === b.dataset.vplay); const p = main.querySelector('[data-vpanel]'); voicePanel(p, { voice: v }); p.querySelector('[data-vplay]')?.click(); p.scrollIntoView({ block: 'nearest' }); });
    main.querySelectorAll('[data-vmore]').forEach(b => {
      const open = (x, y) => { const v = doc().voices.find(z => z.id === b.dataset.vmore); X.popMenu(x, y, [
        { label: t('fam.voice.greet'), icon: 'greetings', fn: () => greetSheet(v) },
        { label: t('fam.delete'), icon: 'info', fn: () => confirmSheet(t('fam.voice.delete'), t('fam.voice.deleteBodyWeb'), t('fam.delete'), () => {
          stopAudio(); doc().voices = doc().voices.filter(z => z.id !== v.id); tomb(v.id); mediaDel(v.id); persist(); draw(); }) }]); };
      b.onclick = e => { const r = b.getBoundingClientRect(); open(r.left, r.bottom); e.stopPropagation(); };
      X.onHold(b.closest('.fm-vline'), open);
    });
  };
  draw();
}
// A voice greeting: the festival's (or a blessing) card, and the recording beside it; the web shares them as two files.
async function greetSheet(v) {
  const td = X.today(), choices = [];
  if (v.attach?.kind === 'festival' && X.festById(v.attach.id)) {
    const f = X.festById(v.attach.id), d = await currentOcc(f.id) || (await X.upcoming(td, 400)).find(x => x.f.id === f.id)?.date || td;
    choices.push({ key: f.id, f, date: d, label: `${X.fname(f)} · ${shortDate(d)}` });
  } else {
    const up = (await X.upcoming(td, 120).catch(() => [])).filter(x => x.date >= td).slice(0, 3);
    up.forEach(x => choices.push({ key: x.f.id + x.date, f: x.f, date: x.date, label: `${X.fname(x.f)} · ${shortDate(x.date)}`, major: x.f.tier === 'major' && x.date <= X.addDays(td, 30) }));
  }
  choices.push({ key: 'blessing', blessing: true, label: t('fam.voice.greetBlessing') });
  const def = choices.find(c => c.major) || (v.attach?.kind === 'festival' ? choices[0] : choices[choices.length - 1]);
  const o = X.sheet(`<h2 class="serif">${esc(t('fam.voice.greet'))}</h2>
    <label class="field"><span>${esc(t('fam.voice.greetFor'))}</span><select id="fmgf">${choices.map(c => `<option value="${esc(c.key)}" ${c === def ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label>
    <div class="fm-gimg" id="fmgi"></div><p class="small muted" id="fmgm"></p><p class="small muted">${esc(t('fam.voice.webNote'))}</p>
    <button class="btn block" id="fmgs" disabled>${X.SHARE_ICON} ${esc(t('fam.voice.greet'))}</button>`);
  let png = null, cur = def;
  const make = async () => {
    png = null; o.querySelector('#fmgs').disabled = true; o.querySelector('#fmgm').textContent = t('fam.voice.makingWeb');
    const line = t('fam.voice.cardLine', v.speaker);
    try {
      if (cur.blessing) {
        const title = voiceTitle(v), f = { id: 'blessing', card: 'lotus', names: { en: title }, content: {} };
        png = await X.cardImage(f, null, { p: X.cardPalette('lotus'), to: '', from: '', msg: '', lang: X.lang(), design: X.suggestedStyle(f), motion: 'still', words: { title, kicker: '' } }, '', line);
      } else png = await X.cardImage(cur.f, cur.date, { p: X.cardPalette(cur.f.card), to: '', from: '', msg: '', lang: X.lang(), design: X.suggestedStyle(cur.f), motion: 'still' }, '', line);
    } catch { o.querySelector('#fmgm').textContent = t('fam.voice.failed'); return; }
    if (!o.isConnected) return;
    o.querySelector('#fmgi').innerHTML = `<img src="${URL.createObjectURL(png)}" alt="">`;
    o.querySelector('#fmgm').textContent = ''; o.querySelector('#fmgs').disabled = false;
  };
  o.querySelector('#fmgf').onchange = e => { cur = choices.find(c => c.key === e.target.value); make(); };
  o.querySelector('#fmgs').onclick = async () => {
    const m = await mediaGet('media', v.id);
    const name = cur.blessing ? voiceTitle(v) : X.fname(cur.f), slug = String(cur.blessing ? 'blessing' : cur.f.id);
    const files = [new File([png], `${slug}-card.png`, { type: 'image/png' })];
    if (m?.blob) files.push(new File([m.blob], `${slug}-voice.${v.ext || 'webm'}`, { type: v.mime || m.type }));
    shareFiles(files, t('fam.voice.shareText', name, v.speaker), name);
  };
  make();
}

// ---------------------------------------------------------------- festival memories (web: a photo picked for each year)
const MEM = { fest: null, picks: new Map() };
async function defaultMemFest() {
  const td = X.today(), y = +td.slice(0, 4), majors = new Set(X.pack().festivals.filter(f => f.tier === 'major' && !f.hidden).map(f => f.id));
  let best = null;
  for (const yy of [y - 1, y]) for (const o of await X.festsAt(yy, X.S.home).catch(() => [])) {
    if (!majors.has(o.id)) continue;
    const end = X.addDays(o.date, (X.festById(o.id)?.durationDays || 1) - 1);
    if (end < td && end >= X.addDays(td, -60) && (!best || o.date > best.date)) best = o;
  }
  if (best) return best.id;
  return (await X.upcoming(td, 400).catch(() => [])).find(x => majors.has(x.f.id))?.f.id || null;
}
async function memYears(id) {
  const f = X.festById(id); if (!f) return [];
  const occ = await currentOcc(id), td = X.today(), y0 = occ ? +occ.slice(0, 4) : +td.slice(0, 4);
  const ended = occ && X.addDays(occ, (f.durationDays || 1) - 1) < td;
  const ys = [...(ended ? [y0] : []), ...[1, 2, 3, 4, 5, 6].map(k => y0 - k)], out = [];
  for (const y of ys) {
    const ds = (await X.festsAt(y, X.S.home).catch(() => [])).filter(o => o.id === id && o.date < td && (!occ || o.date !== occ || ended)).map(o => o.date).sort().reverse();
    for (const d of ds) out.push({ year: +d.slice(0, 4), date: d });
  }
  return out;
}
async function viewMem(main) {
  X.loading();
  let id = FAM.arg || await defaultMemFest(); FAM.arg = id;
  const f = id && X.festById(id), years = f ? await memYears(id) : [];
  if (X.tab() !== 'family' || FAM.screen !== 'mem') return;
  if (MEM.fest !== id) { MEM.fest = id; MEM.picks.forEach(p => URL.revokeObjectURL(p.url)); MEM.picks = new Map(); }
  const majors = X.pack().festivals.filter(x => x.tier === 'major' && !x.hidden).sort((a, b) => X.fname(a).localeCompare(X.fname(b)));
  const tiles = years.slice(0, 3);
  const draw = () => {
    const on = tiles.filter(y => MEM.picks.get(y.year)?.on), picked = tiles.filter(y => MEM.picks.get(y.year));
    main.innerHTML = `<div class="fm">${back()}
      <label class="field"><span>${esc(t('fam.mem.choose'))}</span><select id="fmmf">${majors.map(x => `<option value="${esc(x.id)}" ${x.id === id ? 'selected' : ''}>${esc(X.fname(x))}</option>`).join('')}</select></label>
      ${f ? `<div class="fm-title"><span class="small muted">${esc(years.slice(0, 6).map(y => y.year).join(' · '))}</span><h2 class="serif">${esc(tiles.length === 1 ? t('fam.mem.head1', X.fname(f)) : t('fam.mem.head', X.fname(f), tiles.length))}</h2></div>
      ${tiles.length ? `<div class="fm-collage n${tiles.length}">${tiles.map((y, i) => { const p = MEM.picks.get(y.year);
        return p ? `<div class="fm-mtile${i === 0 ? ' lead' : ''}"><button class="fm-mpick" data-mt="${y.year}" aria-pressed="${p.on}" aria-label="${esc(X.fname(f))} ${y.year}"><img src="${p.url}" alt=""><span class="sel"></span><span class="yr">${y.year}</span></button>
            <button class="fm-another" data-mre="${y.year}" aria-label="${esc(t('fam.mem.another', y.year))}">↻</button></div>`
          : `<label class="fm-mtile empty${i === 0 ? ' lead' : ''}"><input type="file" accept="image/*" hidden data-mfile="${y.year}"><span class="yr">${y.year}</span><span class="small">${esc(t('fam.mem.webPick', y.year))}</span></label>`; }).join('')}</div>` : ''}
      <span class="small muted">${esc(picked.length ? (on.length ? t('fam.mem.tapHint', on.length, picked.length) : t('fam.mem.pickOne')) : t('fam.mem.webNote'))}</span>
      <div class="fm-privacy">${ICON.shield}<span><b>${esc(t('fam.mem.webNote'))}</b> ${esc(t('fam.privacy.web'))}</span></div>
      <section class="fm-sec"><span class="fm-sec-h serif">${esc(t('fam.mem.onDays'))}</span><div class="fm-plist">${years.slice(0, 6).map(y => `<div><span>${esc(t('fam.mem.yearLine', y.year, shortDate(y.date)))}</span><span class="small muted">${esc([MEM.picks.get(y.year) ? t('fam.mem.count1') : '', X.S.home.name].filter(Boolean).join(' · '))}</span></div>`).join('')}</div></section>
      <button class="btn" data-mshare ${on.length ? '' : 'disabled'}>${X.SHARE_ICON} ${esc(t('fam.mem.share'))}</button>` : ''}</div>`;
    main.querySelector('[data-fback]').onclick = () => go('hub');
    main.querySelector('#fmmf').onchange = e => go('mem', e.target.value);
    main.querySelectorAll('[data-mfile]').forEach(inp => inp.onchange = () => pick(+inp.dataset.mfile, inp.files?.[0]));
    main.querySelectorAll('[data-mt]').forEach(b => b.onclick = () => { const p = MEM.picks.get(+b.dataset.mt); p.on = !p.on; draw(); });
    main.querySelectorAll('[data-mre]').forEach(b => b.onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => pick(+b.dataset.mre, i.files?.[0]); i.click(); });
    main.querySelector('[data-mshare]')?.addEventListener('click', async e => {
      const chosen = tiles.filter(y => MEM.picks.get(y.year)?.on).sort((a, b) => a.year - b.year);
      e.currentTarget.disabled = true;
      try { const png = await memoryCard(f, chosen); shareFiles([new File([png], `${f.id}-memories.png`, { type: 'image/png' })], t('fam.mem.cardTitle', X.fname(f), range(chosen)), X.fname(f)); }
      catch { X.toast(t('fam.err.file')); }
      draw();
    });
  };
  const pick = (year, file) => { if (!file) return; const old = MEM.picks.get(year); if (old) URL.revokeObjectURL(old.url); MEM.picks.set(year, { file, url: URL.createObjectURL(file), on: true }); draw(); };
  draw();
}
const range = ys => ys.length > 1 ? `${ys[0].year}–${ys[ys.length - 1].year}` : String(ys[0]?.year || '');
// 1080 x 1350: the years side by side, oldest first, over a paper band with the title, the family and the mark.
async function memoryCard(f, ys) {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#FAF6EF'; g.fillRect(0, 0, W, H);
  const gap = 8, w = (W - gap * (ys.length - 1)) / ys.length;
  for (let i = 0; i < ys.length; i++) {
    const bmp = await createImageBitmap(MEM.picks.get(ys[i].year).file, { imageOrientation: 'from-image' });
    const s = Math.max(w / bmp.width, 1000 / bmp.height), sw = w / s, sh = 1000 / s;
    g.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, i * (w + gap), 0, w, 1000); bmp.close?.();
  }
  g.fillStyle = '#2B2420'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  let z = 64; const title = t('fam.mem.cardTitle', X.fname(f), range(ys));
  g.font = `600 ${z}px Georgia, "Noto Serif", serif`; while (g.measureText(title).width > W - 120 && z > 36) { z -= 2; g.font = `600 ${z}px Georgia, "Noto Serif", serif`; }
  g.fillText(title, 60, 1130);
  const fam = doc().familyName, line = t('fam.mem.cardLine', [fam, X.S.home.name].filter(Boolean).join(' · '));
  g.font = '32px Georgia, serif'; g.fillStyle = '#6F6359'; g.fillText(line, 60, 1190, W - 120);
  const logo = new Image(); logo.src = 'icon-192.png'; await logo.decode().catch(() => {});
  g.globalAlpha = .7; if (logo.complete && logo.naturalWidth) g.drawImage(logo, W - 60 - 74, H - 58 - 24, 26, 26);
  g.font = '600 24px Georgia, serif'; g.fillStyle = '#2B2420'; g.fillText('Eka', W - 60 - 42, H - 62); g.globalAlpha = 1;
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('encode')), 'image/png'));
}

// ---------------------------------------------------------------- kuladevata
// key, label key, prayer deities (first in Prayers), temple deities, icon.
const DEITIES = [
  ['murugan', 'deity.murugan', ['murugan'], ['murugan'], 'murugan'],
  ['venkateswara', 'deity.venkateswara', ['vishnu'], ['venkateswara', 'vishnu'], 'vishnu'],
  ['devi', 'deity.devi', ['lakshmi', 'saraswati'], ['devi', 'lakshmi', 'saraswati'], 'devi'],
  ['bhagavathi', 'fam.kula.d.bhagavathi', ['lakshmi', 'saraswati'], ['devi'], 'devi'],
  ['ganesha', 'deity.ganesha', ['ganesha'], ['ganesha'], 'ganesha'],
  ['shiva', 'deity.shiva', ['shiva'], ['shiva'], 'shiva'],
  ['vishnu', 'deity.vishnu', ['vishnu', 'krishna'], ['vishnu', 'venkateswara', 'rama', 'jagannath'], 'vishnu'],
  ['krishna', 'deity.krishna', ['krishna', 'vishnu'], ['krishna', 'jagannath'], 'krishna'],
  ['guruvayurappan', 'fam.kula.d.guruvayurappan', ['krishna', 'vishnu'], ['krishna'], 'krishna'],
  ['hanuman', 'deity.hanuman', ['hanuman'], ['hanuman'], 'hanuman'],
  ['ayyappa', 'deity.ayyappa', ['ayyappa'], ['ayyappa'], 'ayyappa'],
  ['lakshmi', 'deity.lakshmi', ['lakshmi'], ['lakshmi', 'devi'], 'lakshmi'],
];
const DEITY = Object.fromEntries(DEITIES.map(([k, label, prayers, temples, icon]) => [k, { k, label, prayers, temples, icon }]));
const GURUVAYUR = ['guruvayur', 'ambalappuzha', 'guruvayur-mammiyoor'];
const deityName = k => DEITY[k] ? t(DEITY[k].label) : k === 'custom' ? (ownOf(doc().kula)?.name || t('fam.kula.own')) : k || '';
// The festivals that also ring, per deity: one JSON literal, the same on iOS and Android.
const KULA_FESTS = {"murugan":["thaipusam","thaipusam-mu","thai-pooyam","soorasamharam","subrahmanya-sashti","subrahmanya-shashti-te","champa-shashti","vaikasi-visakam","panguni-uthiram","painkuni-uthram","karthigai-deepam","thrikkarthika"],"venkateswara":["vaikunta-ekadashi","vaikuntha-ekadashi-kn","mukkoti-ekadasi","mukkoti-ekadasi-te","purattasi-sani"],"devi":["navarathiri","navarathri-ml","navaratri-kn","navaratri-te","navratri","navratri-gu","navratri-mr","ghatasthapana","durga-puja-bn","durga-puja-or","maha-shashthi","maha-saptami","maha-ashtami-bn","maha-ashtami-ne","maha-navami","maha-navami-bn","maha-navami-ne","maha-navami-te","mahanavami","durga-ashtami","durga-ashtami-gu","durgashtami","durgashtami-te","kali-puja","jagaddhatri-puja","aadi-velli","aadi-pooram","attukal-pongala","bonalu","bathukamma","vijayadashami-kn","vijayadashami-ml","vijayadashami-ta","vijayadashami-te","vijaya-dashami-ne","bijoya-dashami"],"bhagavathi":["navarathiri","navarathri-ml","navaratri-kn","navaratri-te","navratri","navratri-gu","navratri-mr","ghatasthapana","durga-puja-bn","durga-puja-or","maha-shashthi","maha-saptami","maha-ashtami-bn","maha-ashtami-ne","maha-navami","maha-navami-bn","maha-navami-ne","maha-navami-te","mahanavami","durga-ashtami","durga-ashtami-gu","durgashtami","durgashtami-te","kali-puja","jagaddhatri-puja","aadi-velli","aadi-pooram","attukal-pongala","bonalu","bathukamma","vijayadashami-kn","vijayadashami-ml","vijayadashami-ta","vijayadashami-te","vijaya-dashami-ne","bijoya-dashami"],"ganesha":["ganesh-chaturthi","ganesh-chaturthi-gu","ganesh-chaturthi-ne","ganesh-chaturthi-or","ganesha-chaturthi-kn","ganeshotsav","vinayagar-chathurthi","vinayaka-chathurthi-ml","vinayaka-chavithi","ganesha-jayanti-mr","sakat-chauth","anant-chaturdashi","anant-chaturdashi-gu","anant-chaturdashi-mr"],"shiva":["maha-shivaratri","maha-shivaratri-bn","maha-shivaratri-gu","maha-shivaratri-kn","maha-shivaratri-ml","maha-shivaratri-mr","maha-shivaratri-ne","maha-shivaratri-or","maha-shivaratri-ta","maha-shivaratri-te","arudra-darshan","thiruvathira","karthigai-deepam","kartika-purnima-mr","kedara-gowri"],"vishnu":["vaikunta-ekadashi","vaikuntha-ekadashi-kn","mukkoti-ekadasi","mukkoti-ekadasi-te","narasimha-jayanti","narasimha-jayanti-gu","narasimha-jayanti-kn","narasimha-jayanti-te","narasimha-jayanthi-ml","tulsi-vivah","tulsi-vivah-gu","tulsi-vivah-mr","tulasi-habba"],"krishna":["janmashtami","janmashtami-bn","janmashtami-gu","janmashtami-mr","janmashtami-ne","janmashtami-or","gokulashtami","krishna-janmashtami-kn","krishnashtami-te","ashtami-rohini","gopalkala","radha-ashtami","gita-jayanti","gita-jayanti-gu","govardhan-puja","dol-purnima","dola-purnima","jhulan-purnima"],"guruvayurappan":["guruvayur-ekadasi","ashtami-rohini","vishu"],"hanuman":["hanuman-jayanti","hanuman-jayanti-gu","hanuman-jayanti-kn","hanuman-jayanti-mr","hanuman-jayanti-ne","hanuman-jayanti-te","hanumath-jayanthi-ta"],"ayyappa":["mandala-kalam","mandala-pooja","makaravilakku","painkuni-uthram","panguni-uthiram"],"lakshmi":["varalakshmi-vratam","varalakshmi-vratam-te","varamahalakshmi","kojagari-lakshmi-puja","kojagiri","kojagrat-purnima","sharad-purnima","sharad-purnima-gu","lakshmi-puja-mr","laxmi-puja-ne","diwali","diwali-gu","deepavali-kn","dhanteras","dhanteras-gu","dhanteras-mr"]};
const RULES = { murugan: ['SHASHTI', 'KRITTIKA'], venkateswara: ['saturday', 'EKADASHI'], devi: ['friday', 'POURNAMI'], bhagavathi: ['friday', 'POURNAMI'],
  ganesha: ['VINAYAKA_CHATURTHI', 'SANKASHTI'], shiva: ['PRADOSHAM', 'MASA_SHIVARATRI'], vishnu: ['EKADASHI'], krishna: ['EKADASHI'], guruvayurappan: ['EKADASHI'],
  hanuman: ['tuesday', 'saturday'], ayyappa: ['saturday', 'MANDALA'], lakshmi: ['friday'] };
const shukla = c => (c.tithiIndex || 0) <= 15;
// Each alias: the pack's own observance ids, else a test on the cell's sunrise limbs, and the reason's fallback words.
const ALIAS = {
  EKADASHI: [['ekadashi'], c => c.tithi === 'ekadashi', () => X.recName('ekadashi')],
  POURNAMI: [['pournami', 'purnima'], c => c.tithi === 'purnima', () => X.name('tithis', 'purnima')],
  PRADOSHAM: [['pradosham', 'pradosh'], c => c.tithi === 'trayodashi', () => t('fam.kula.r.pradosham')],
  SANKASHTI: [['sankatahara-chathurthi', 'sankashti-chaturthi', 'sankashti-chathurthi'], c => c.tithi === 'chaturthi' && !shukla(c), () => t('fam.kula.r.sankashti')],
  VINAYAKA_CHATURTHI: [['vinayaka-chaturthi'], c => c.tithi === 'chaturthi' && shukla(c), () => t('fam.kula.r.chaturthi')],
  SHASHTI: [['shashti'], c => c.tithi === 'shashthi' && shukla(c), () => X.name('tithis', 'shashthi')],
  KRITTIKA: [['karthigai'], (c, prev) => c.nakshatra === 'krittika' && prev?.nakshatra !== 'krittika', () => X.name('nakshatras', 'krittika')],
};
const temples = () => TEMPLES_P ??= fetch('temples.json?v=' + X.V).then(r => r.json()).catch(() => { TEMPLES_P = null; return { temples: [] }; });
let TEMPLES_P = null;
async function cellsRange(from, to, place) {
  const out = [];
  for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) {
    const a = from > `${y}-01-01` ? from : `${y}-01-01`, b = to < `${y}-12-31` ? to : `${y}-12-31`;
    out.push(...await X.engine({ op: 'month', handle: await X.cal(y, place), from: a, to: b }));
  }
  return out;
}
const KCACHE = new Map();
// The deity's days from..to at a place: date -> the reason ("Saturday", "Thaipusam", "Mandala season, day 12").
// Festivals first, then each rule in its order; Masa Shivaratri from the tithi at nishita when the pack has no observance.
export function kulaMarks(from, to, place = X.S.home, deity = doc().kula?.deity) {
  const own = deity === 'custom' ? ownOf(doc().kula) : null;
  if (!deity || (!DEITY[deity] && !own)) return Promise.resolve(new Map());
  const key = `${deity}|${own ? JSON.stringify(own.rules) : ''}|${X.S.culture}|${X.S.vaishnava ? 1 : 0}|${place.id}|${place.latitude}|${from}|${to}`;
  if (!KCACHE.has(key)) { const p = own ? ownMarks(from, to, place, own.rules) : computeMarks(from, to, place, deity); p.catch(() => KCACHE.delete(key)); KCACHE.set(key, p); }
  return KCACHE.get(key);
}
async function computeMarks(from, to, place, deity) {
  const cells = await cellsRange(X.addDays(from, -41), to, place), out = new Map(), pk = X.pack();
  const recKeys = new Set((pk.dailySignificance || []).map(r => r.key));
  const mark = (d, r) => { if (d >= from && d <= to && !out.has(d)) out.set(d, r); };
  const fs = new Set(KULA_FESTS[deity] || []);
  for (const c of cells) { const id = (c.festivals || []).find(x => fs.has(x)); if (id) { const f = X.festById(id); mark(c.date, f ? X.fname(f) : id); } }
  for (const r of RULES[deity] || []) {
    if (/^[a-z]+day$/.test(r)) { for (const c of cells) if (c.weekday === r) mark(c.date, X.name('weekdays', r)); continue; }
    if (ALIAS[r]) {
      const [ids, test, label] = ALIAS[r], own = ids.filter(k => recKeys.has(k));
      cells.forEach((c, i) => {
        if (own.length) { const hit = (c.recurring || []).find(x => own.includes(x)); if (hit) mark(c.date, X.recName(hit) || label()); }
        else if (test(c, cells[i - 1])) mark(c.date, label());
      });
      continue;
    }
    if (r === 'MASA_SHIVARATRI') {
      if (recKeys.has('masik-shivaratri')) { for (const c of cells) if ((c.recurring || []).includes('masik-shivaratri')) mark(c.date, X.recName('masik-shivaratri') || t('fam.kula.r.shivaratri')); continue; }
      const cand = cells.filter(c => c.tithiIndex === 28 || c.tithiIndex === 29), groups = [];
      for (const c of cand) { const g = groups[groups.length - 1]; if (g && X.daysBetween(g[g.length - 1].date, c.date) <= 1 && g.length < 2) g.push(c); else groups.push([c]); }
      for (const g of groups) {
        if (g[g.length - 1].date < from || g[0].date > to) continue;
        let pick = null;
        for (const c of g) {
          const p = await X.day(c.date, place).catch(() => null); if (!p) continue;
          const mid = (p.sunset + p.nextSunrise) / 2;
          if (p.tithis.some(x => x.index === 29 && x.start <= mid && mid < x.end)) { pick = c; break; }
        }
        pick ??= g.find(c => c.tithiIndex === 29);
        if (pick) mark(pick.date, t('fam.kula.r.shivaratri'));
      }
      continue;
    }
    if (r === 'MANDALA') {
      const has = id => pk.festivals.some(f => f.id === id);
      if (has('mandala-kalam') && has('mandala-pooja')) {
        const all = [];
        for (let y = +from.slice(0, 4) - 1; y <= +to.slice(0, 4); y++) all.push(...await X.festsAt(y, place).catch(() => []));
        const ends = all.filter(o => o.id === 'mandala-pooja').map(o => o.date).sort();
        for (const s of all.filter(o => o.id === 'mandala-kalam').map(o => o.date)) {
          const e = ends.find(d => d >= s); if (!e) continue;
          for (let d = s, n = 1; d <= e; d = X.addDays(d, 1), n++) mark(d, t('fam.kula.r.mandala', n));
        }
      } else if (cells.some(c => c.solar)) {
        for (const c of cells) if (c.solar?.month === 'vrishchika' && c.solar.day === 1) for (let k = 0; k < 41; k++) mark(X.addDays(c.date, k), t('fam.kula.r.mandala', k + 1));
      }
    }
  }
  return out;
}
export const kulaOn = () => { const k = doc().kula; return !!(k?.onCalendar && (DEITY[k.deity] || ownOf(k))); };
export const kulaDeityName = () => deityName(doc().kula?.deity);
export const kulaLegend = () => `<span><i class="fm-kulamk"></i>${esc(t('fam.kula.legend', kulaDeityName()))}</span>`;
export const kulaNote = (d, reason) => t('fam.kula.dayNote', shortDate(d), reason, kulaDeityName());
// The prayers in the book for the family deity: the exact deity first, then the table's list.
export function kulaPrayers(book) {
  const k = doc().kula?.deity; if (!k || !DEITY[k] || !book) return null;
  const order = [k, ...DEITY[k].prayers.filter(d => d !== k)];
  const ps = order.flatMap(d => book.prayers.filter(p => p.deity === d));
  return { prayers: ps, deity: order.find(d => book.deities.includes(d)) || null, name: deityName(k) };
}
// ---------------------------------------------------------------- our own family deity
// A village or family deity not in the list: { deity: 'custom', custom: { id, name, altName, temple: {name, place?},
// rules } }, the same document on every platform. Each rule is a festival of the tradition's pack, a tithi, a star or
// a weekday, every month (week) or only in one month of the tradition's own month system.
export const ownOf = k => k?.deity === 'custom' && k.custom && typeof k.custom === 'object' ? { ...k.custom, rules: Array.isArray(k.custom.rules) ? k.custom.rules : [] } : null;
const ownFull = c => c?.name ? c.name + (c.altName ? ` (${c.altName})` : '') : '';
export const kulaTempleLabel = k => { const c = ownOf(k); return c ? [c.temple?.name, c.temple?.place?.name].filter(Boolean).join(', ') : templeLabel(k?.temple); };
// The tradition's primary month system: its solar months (Tamil, Malayalam, Bengali...) or its lunar months.
function monthSys() {
  const pk = X.pack(), solar = pk?.display?.primary === 'solar', table = solar ? 'solarMonths' : 'lunarMonths';
  // A month of the other system (a deity written under another tradition) still reads as a name.
  const name = m => [table, solar ? 'lunarMonths' : 'solarMonths'].map(tb => pk?.names?.[tb]?.[m] ? X.name(tb, m) : null).find(Boolean) || m;
  return { solar, keys: Object.keys(pk?.names?.[table] || {}), name, of: c => solar ? c.solar?.month : (c.lunar && !c.lunar.adhika ? c.lunar.month : null) };
}
const TITHI_KEYS = () => Object.keys(X.pack()?.names?.tithis || {});
// Tithi 1–15 within its paksha; 15 is Purnima in Shukla and Amavasya in Krishna. The engine's index runs 1–30.
const tithiIdx = r => (r.paksha === 'krishna' ? 15 : 0) + (+r.tithi || 0);
const tithiName = (paksha, n) => n === 15 ? X.name('tithis', paksha === 'krishna' ? 'amavasya' : 'purnima') : `${X.name('paksha', paksha === 'krishna' ? 'krishna' : 'shukla')} ${X.name('tithis', TITHI_KEYS()[n - 1])}`;
// A rule as words: "Panguni Uthiram", "Uthiram in Panguni", "Shukla Sashti, every month", "Fridays in Aadi".
function ruleText(r) {
  const M = monthSys(), mon = r.month ? M.name(r.month) : '';
  if (r.type === 'festival') { const f = X.festById(r.id); return t('fam.kula.ruleFest', f ? X.fname(f) : r.id); }
  // "Fridays in Aadi": in English the plain weekday, since the pack's English names (Velli) take no plural.
  if (r.type === 'weekday') { const wk = WD[r.day] || 'sunday', w = mon && X.lang() === 'en' ? wk[0].toUpperCase() + wk.slice(1) : X.name('weekdays', wk); return mon ? t('fam.kula.ruleWeekM', w, mon) : t('fam.kula.ruleWeekly', w); }
  const base = r.type === 'tithi' ? tithiName(r.paksha, +r.tithi) : X.name('nakshatras', r.key);
  return mon ? t('fam.kula.ruleTithiM', base, mon) : t('fam.kula.ruleEvery', base);
}
// The words on a ringed day: the festival, the rule kept once a year, or the tithi, star or weekday itself.
function ruleReason(r) {
  if (r.type === 'festival' || r.month) return ruleText(r);
  return r.type === 'weekday' ? X.name('weekdays', WD[r.day] || 'sunday') : r.type === 'tithi' ? tithiName(r.paksha, +r.tithi) : X.name('nakshatras', r.key);
}
// A day kept by a rule, from what the engine gives each day at sunrise; a tithi or star that holds two sunrises counts
// on the first.
function ruleHit(r, c, prev, M) {
  if (r.month && M.of(c) !== r.month) return false;
  if (r.type === 'festival') return (c.festivals || []).includes(r.id);
  if (r.type === 'weekday') return c.weekday === WD[r.day];
  if (r.type === 'tithi') { const i = tithiIdx(r); return c.tithiIndex === i && prev?.tithiIndex !== i; }
  if (r.type === 'nakshatra') return c.nakshatra === r.key && prev?.nakshatra !== r.key;
  return false;
}
export async function ownMarks(from, to, place, rules) {
  const cells = await cellsRange(X.addDays(from, -1), to, place), out = new Map(), M = monthSys();
  // The festival rules first, then the others in their saved order.
  for (const r of [...rules.filter(x => x.type === 'festival'), ...rules.filter(x => x.type !== 'festival')]) {
    const why = ruleReason(r);
    cells.forEach((c, i) => { if (c.date >= from && c.date <= to && !out.has(c.date) && ruleHit(r, c, cells[i - 1], M)) out.set(c.date, why); });
  }
  return out;
}
// Our temple's festival: the next day of the first festival rule, else of the first rule kept once a year; at the
// temple's place when it has one, else at home.
async function ownNext(c) {
  const M = monthSys(), r = c.rules.find(x => x.type === 'festival') || c.rules.find(x => x.month && M.keys.includes(x.month)); if (!r) return null;
  const place = c.temple?.place?.tz && c.temple.place.latitude != null ? c.temple.place : X.S.home;
  const td = X.today(), m = await ownMarks(td, X.addDays(td, 400), place, [r]);
  const date = [...m.keys()].sort()[0];
  return date ? { date, rule: r, place } : null;
}
async function ownTempleCard(el, c) {
  if (!c.rules.some(x => x.type === 'festival' || x.month)) { el.innerHTML = ''; return; }
  el.innerHTML = `<p class="small muted">${esc(t('fam.clock.reading'))}</p>`;
  const r = await ownNext(c).catch(() => null);
  if (!el.isConnected) return;
  if (!r) { el.innerHTML = ''; return; }
  const nm = ruleText(r.rule), sub = c.temple?.name || '', dateText = X.greg(r.date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  el.innerHTML = `<div class="fm-temple"><span class="fm-eyebrow">${esc(t('fam.kula.festival'))}</span><h3 class="serif">${esc(nm)}</h3>
    ${sub ? `<span class="small" style="opacity:.85">${esc(sub)}</span>` : ''}<span class="fm-when">${esc(t('fam.kula.festivalWhen', dateText, r.place.name))}</span>
    <button class="fm-pill gold" data-tshare>${X.SHARE_ICON} ${esc(t('fam.kula.shareFam'))}</button></div>`;
  el.querySelector('[data-tshare]').onclick = async e => {
    e.currentTarget.disabled = true;
    const fest = r.rule.type === 'festival' ? X.festById(r.rule.id) : null, f = { id: fest?.id || 'kula-' + (c.id || 'own'), card: fest?.card || 'diya', names: { en: nm }, content: {} };
    const design = X.REGION_STYLE[X.S.culture] || 'heritage', place = [sub, r.place.name].filter(Boolean).join(', ');
    try {
      const png = await X.cardImage(f, null, { p: X.cardPalette(f.card), to: '', from: c.name, msg: '', lang: X.lang(), design, motion: 'still', words: { title: nm, sub: sub || c.name, kicker: t('fam.kula.festival'), from: c.name } }, '', `${dateText} · ${r.place.name}`);
      await shareFiles([new File([png], `${f.id}-temple.png`, { type: 'image/png' })], t('fam.kula.shareText', nm, place || c.name, dateText), nm);
    } catch { X.toast(t('fam.err.file')); }
    if (el.isConnected) el.querySelector('[data-tshare]').disabled = false;
  };
}
// The editor: a name (any script) and another spelling, the temple and its place, and the days kept.
function ownEditor(done) {
  // Choosing a listed deity keeps our own in the document, so the editor opens with it again.
  const k0 = doc().kula, cur = ownOf(k0), c0 = cur || ownOf({ deity: 'custom', custom: k0?.custom }), M = monthSys(), pk = X.pack();
  const st = { tplace: c0?.temple?.place || null, rules: (c0?.rules || []).map(r => ({ ...r })), kind: 'festival' };
  const o = X.sheet(`<h2 class="serif">${esc(t('fam.kula.ownTitle'))}</h2><p class="small muted">${esc(t('fam.kula.ownHint'))}</p>
    <label class="field"><span>${esc(t('fam.kula.name'))}</span><input type="text" id="foN" maxlength="80" placeholder="${esc(t('fam.kula.namePh'))}" value="${esc(c0?.name || '')}"></label>
    <label class="field"><span>${esc(t('fam.kula.alt'))}</span><input type="text" id="foA" maxlength="80" value="${esc(c0?.altName || '')}"></label>
    <label class="field"><span>${esc(t('fam.kula.oTemple'))}</span><input type="text" id="foT" maxlength="120" placeholder="${esc(t('fam.kula.templePh'))}" value="${esc(c0?.temple?.name || '')}"></label>
    <div class="fm-chips fm-oplace" id="foP"></div>
    <p class="label">${esc(t('fam.kula.days'))}</p><div id="foR"></div>
    <div class="card fm-oadd"><div class="fm-chips" role="group" aria-label="${esc(t('fam.kula.addDay'))}">${['festival', 'tithi', 'nakshatra', 'weekday'].map(k => `<button class="fm-chip" data-ok="${k}" aria-pressed="false">${esc(t('fam.kula.r.' + k))}</button>`).join('')}</div>
      <div id="foF" class="fm-ofields"></div><button class="btn soft fm-sm" data-oadd>＋ ${esc(t('fam.kula.addDay'))}</button></div>
    <p class="small fm-warn" id="foE" role="alert" hidden></p>
    <div class="fm-btns"><button class="btn soft" data-no>${esc(t('c.cancel'))}</button><button class="btn" data-yes>${esc(t('c.save'))}</button></div>
    ${c0 ? `<button class="linkbtn" data-odel style="margin-top:10px">${esc(t('fam.kula.delOwn'))}</button>` : ''}`);
  const q = s => o.querySelector(s);
  const opt = (v, label, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(label)}</option>`;
  const monthSel = every => `<select id="foM" aria-label="${esc(t('fam.kula.days'))}">${opt('', t(every))}${M.keys.map(m => opt(m, t('fam.kula.onlyIn', M.name(m)))).join('')}</select>`;
  const drawPlace = () => {
    q('#foP').innerHTML = `<button class="fm-chip" data-opl aria-pressed="${!!st.tplace}">📍 ${esc(st.tplace?.name || t('fam.kula.oTemplePlace'))}</button>${st.tplace ? `<button class="fm-chip" data-oplx aria-label="${esc(t('fam.remove'))}">✕</button>` : ''}`;
    q('[data-opl]').onclick = () => { const o2 = X.sheet(`<h2 class="serif">${esc(t('fam.kula.oTemplePlace'))}</h2><div id="fmcp"></div>`, o2 => X.placePicker(o2.querySelector('#fmcp'), place => { o2.remove(); st.tplace = place; drawPlace(); })); };
    q('[data-oplx]')?.addEventListener('click', () => { st.tplace = null; drawPlace(); });
  };
  const drawRules = () => {
    q('#foR').innerHTML = st.rules.length ? `<div class="card fm-list">${st.rules.map((r, i) => `<div class="fm-check fm-orule"><span class="grow">${esc(ruleText(r))}</span><button class="fm-more" data-orm="${i}" aria-label="${esc(t('fam.remove'))}: ${esc(ruleText(r))}">✕</button></div>`).join('')}</div>` : '';
    o.querySelectorAll('[data-orm]').forEach(b => b.onclick = () => { st.rules.splice(+b.dataset.orm, 1); drawRules(); });
  };
  const fests = () => (pk?.festivals || []).filter(f => !f.hidden).map(f => [f.id, X.fname(f)]).sort((a, b) => a[1].localeCompare(b[1], X.lang()));
  const drawFields = () => {
    o.querySelectorAll('[data-ok]').forEach(b => b.setAttribute('aria-pressed', b.dataset.ok === st.kind));
    const k = st.kind, el = q('#foF');
    if (k === 'festival') el.innerHTML = `<select id="foX" aria-label="${esc(t('fam.kula.r.festival'))}">${fests().map(([id, n]) => opt(id, n)).join('')}</select>`;
    else if (k === 'tithi') {
      el.innerHTML = `<select id="foK" aria-label="${esc(t('fam.kula.r.tithi'))}">${opt('shukla', t('fam.kula.shukla'))}${opt('krishna', t('fam.kula.krishna'))}</select><select id="foX" aria-label="${esc(t('fam.kula.r.tithi'))}"></select>${monthSel('fam.kula.everyMonth')}`;
      const fill = () => { const pa = q('#foK').value, v = q('#foX').value || '6'; q('#foX').innerHTML = Array.from({ length: 15 }, (_, i) => opt(i + 1, i === 14 ? X.name('tithis', pa === 'krishna' ? 'amavasya' : 'purnima') : X.name('tithis', TITHI_KEYS()[i]), String(i + 1) === v)).join(''); };
      q('#foK').onchange = fill; fill();
    } else if (k === 'nakshatra') el.innerHTML = `<select id="foX" aria-label="${esc(t('fam.kula.r.nakshatra'))}">${Object.keys(pk?.names?.nakshatras || {}).map(n => opt(n, X.name('nakshatras', n))).join('')}</select>${monthSel('fam.kula.everyMonth')}`;
    else el.innerHTML = `<select id="foX" aria-label="${esc(t('fam.kula.r.weekday'))}">${WD.map((w, i) => opt(i, X.name('weekdays', w), i === 5)).join('')}</select>${monthSel('fam.kula.everyWeek')}`;
  };
  o.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => { st.kind = b.dataset.ok; drawFields(); });
  q('[data-oadd]').onclick = () => {
    const k = st.kind, v = q('#foX')?.value, m = q('#foM')?.value || undefined; if (v == null || v === '') return;
    const r = k === 'festival' ? { type: k, id: v } : k === 'tithi' ? { type: k, paksha: q('#foK').value, tithi: +v } : k === 'nakshatra' ? { type: k, key: v } : { type: k, day: +v };
    if (m && k !== 'festival') r.month = m;
    if (!st.rules.some(x => JSON.stringify(x) === JSON.stringify(r))) st.rules.push(r);
    q('#foE').hidden = true; drawRules();
  };
  const err = k => { const e = q('#foE'); e.textContent = t(k); e.hidden = false; };
  q('[data-no]').onclick = () => o.remove();
  q('[data-yes]').onclick = () => {
    const name = q('#foN').value.trim().slice(0, 80); if (!name) { err('fam.kula.needName'); return q('#foN').focus(); }
    if (!st.rules.length) return err('fam.kula.needDay');
    const tname = q('#foT').value.trim().slice(0, 120);
    const custom = { id: c0?.id || uuid(), name, altName: q('#foA').value.trim().slice(0, 80) || null,
      temple: tname || st.tplace ? { ...(tname ? { name: tname } : {}), ...(st.tplace ? { place: st.tplace } : {}) } : null, rules: st.rules };
    const F = doc(); F.kula = F.kula ? touch({ ...F.kula, deity: 'custom', custom, temple: null }) : rec({ deity: 'custom', custom, temple: null, onCalendar: true });
    persist(); o.remove(); done(true);
  };
  // Deleting our own while it is chosen leaves no family deity; while a listed one is chosen, only ours goes.
  q('[data-odel]')?.addEventListener('click', () => confirmSheet(t('fam.kula.delOwn'), ownFull(c0), t('fam.delete'), () => {
    const F = doc(); F.kula = cur ? null : touch({ ...F.kula, custom: null }); persist(); o.remove(); done(); }));
  drawPlace(); drawRules(); drawFields();
  setTimeout(() => q('#foN').focus(), 50);
}
const templeLabel = tp => !tp ? '' : tp.id ? (TEMPLE_NAMES.get(tp.id) || '') : [tp.name, tp.place].filter(Boolean).join(', ');
const TEMPLE_NAMES = new Map();
// The temple's annual festival, as the temple keeps it: by the table's tradition, at the temple. Two rows of the
// spec (Chottanikkara, Meenakshi) are left out by decision.
const TEMPLE_FEST_ROWS = [
  [['palani'], 'tamil', 'thaipusam'], [['tiruchendur', 'pazhamudircholai'], 'tamil', 'soorasamharam'], [['swamimalai'], 'tamil', 'vaikasi-visakam'],
  [['thiruparankundram', 'kanchi-ekambareswarar'], 'tamil', 'panguni-uthiram'], [['batu-caves'], 'malaysian-tamil', 'thaipusam'], [['kukke', 'ghati-subramanya'], 'kannada', 'champa-shashti'],
  [['tirumala'], 'telugu', 'mukkoti-ekadasi-te'], [['srirangam'], 'tamil', 'vaikunta-ekadashi'], [['srivilliputhur'], 'tamil', 'andal-jayanthi'], [['guruvayur'], 'malayalam', 'guruvayur-ekadasi'],
  [['sabarimala', 'sabarimala-pandalam'], 'malayalam', 'makaravilakku'], [['attukal'], 'malayalam', 'attukal-pongala'], [['vadakkunnathan'], 'malayalam', 'thrissur-pooram'],
  [['pandharpur'], 'marathi', 'ashadhi-ekadashi'], [['puri', 'puri-gundicha', 'hyderabad-jagannath'], 'odia', 'rath-yatra-or'], [['ranchi-jagannath'], 'north-indian', 'jagannath-rathyatra'],
  [['kashi-vishwanath', 'mahakaleshwar'], 'north-indian', 'maha-shivaratri'], [['somnath', 'nageshwar'], 'gujarati', 'maha-shivaratri-gu'], [['srisailam', 'vemulawada'], 'telugu', 'maha-shivaratri-te'],
  [['pashupatinath'], 'nepali', 'maha-shivaratri-ne'], [['koneswaram', 'munneswaram'], 'sri-lankan-tamil', 'maha-shivaratri-ta'], [['tiruvannamalai'], 'tamil', 'karthigai-deepam'],
  [['chidambaram-nataraja'], 'tamil', 'arudra-darshan'], [['madurai-mukkuruni', 'pillaiyarpatti', 'karpaga-vinayagar', 'rockfort'], 'tamil', 'vinayagar-chathurthi'],
  [['siddhivinayak', 'dagdusheth', 'siddhatek'], 'marathi', 'ganeshotsav'], [['ujjain-chintaman'], 'north-indian', 'ganesh-chaturthi'], [['madhur', 'pazhavangadi'], 'malayalam', 'vinayaka-chathurthi-ml'],
  [['chamundeshwari'], 'kannada', 'vijayadashami-kn'], [['kollur-mookambika', 'sringeri', 'sringeri-2'], 'kannada', 'navaratri-kn'], [['panachikkadu'], 'malayalam', 'vijayadashami-ml'],
  [['vaishno-devi'], 'north-indian', 'navratri'], [['kalighat', 'dakshineswar', 'tarapith'], 'bengali', 'kali-puja'], [['kanaka-durga'], 'telugu', 'navaratri-te'], [['ujjaini-mahankali'], 'telugu', 'bonalu'],
  [['tuljapur', 'kolhapur-mahalakshmi', 'mumbai-mahalakshmi'], 'marathi', 'navratri-mr'], [['ambaji'], 'gujarati', 'navratri-gu'], [['ayodhya-ram', 'ayodhya-kanak'], 'north-indian', 'ram-navami'],
  [['bhadrachalam'], 'telugu', 'rama-navami-te'], [['hanuman-garhi', 'sankat-mochan', 'salasar', 'mehandipur'], 'north-indian', 'hanuman-jayanti'],
  [['mathura-janmabhoomi', 'banke-bihari', 'prem-mandir', 'iskcon-vrindavan', 'vrindavan-radha-raman', 'dwarkadhish-mathura', 'iskcon-delhi', 'nathdwara', 'new-vrindaban'], 'north-indian', 'janmashtami'],
  [['dwarkadhish', 'dakor', 'dwarka-bet', 'ahmedabad-iskcon'], 'gujarati', 'janmashtami-gu'], [['udupi-krishna', 'bengaluru-iskcon'], 'kannada', 'krishna-janmashtami-kn'],
  [['kolkata-iskcon'], 'bengali', 'janmashtami-bn'], [['simhachalam'], 'telugu', 'akshaya-tritiya-te'], [['yadagirigutta', 'dharmapuri-tg'], 'telugu', 'narasimha-jayanti-te'],
];
// The build turns this on when it ships content/src/family-temples.json (scripts/build-web.sh).
const TEMPLE_FILE = false;
const TEMPLE_FEST_BUILTIN = Object.fromEntries(TEMPLE_FEST_ROWS.flatMap(([ids, culture, festival]) => ids.map(id => [id, { culture, festival }])));
// content/src/family-temples.json when the build ships it, else the same table built in.
let TF_P = null;
const templeTable = () => TF_P ??= (!TEMPLE_FILE ? Promise.resolve(null) : fetch('family-temples.json?v=' + X.V).then(r => r.ok ? r.json() : null).catch(() => null))
  .then(j => { const o = j && typeof j === 'object' ? Object.fromEntries(Object.entries(j).filter(([k, v]) => !k.startsWith('_') && v?.culture && v?.festival)) : null; return o && Object.keys(o).length ? o : TEMPLE_FEST_BUILTIN; });
const PK = new Map(), OH = new Map();
function packOf(c) {
  if (!PK.has(c)) { const p = fetch(`packs/${c}.json?v=${X.V}`).then(r => r.text()).then(json => ({ json, pack: JSON.parse(json) })); p.catch(() => PK.delete(c)); PK.set(c, p); }
  return PK.get(c);
}
function openWith(y, loc, c, json) {
  const key = `${c}|${loc.id}|${loc.latitude}|${loc.longitude}|${y}`;
  if (!OH.has(key)) { const h = X.engine({ op: 'open', year: y, location: loc, pack: json }).then(r => r.handle); h.catch(() => OH.delete(key)); OH.set(key, h); }
  return OH.get(key);
}
const TFEST = new Map();
async function templeFestival(tp) {
  const row = (await templeTable())[tp.id]; if (!row) return null;
  const key = tp.id + '|' + X.today(); if (TFEST.has(key)) return TFEST.get(key);
  const p = (async () => {
    const { json, pack } = await packOf(row.culture), f = pack.festivals.find(x => x.id === row.festival); if (!f) return null;
    const near = await X.nearest(tp.lat, tp.lon);
    const loc = { id: 'temple-' + tp.id, name: tp.place, region: near?.region || '', country: near?.country || 'IN', latitude: tp.lat, longitude: tp.lon, tz: near?.tz || 'Asia/Kolkata' };
    const td = X.today(), y = +td.slice(0, 4);
    for (const yy of [y, y + 1]) {
      const list = await X.engine({ op: 'festivals', handle: await openWith(yy, loc, row.culture, json) });
      const d = list.filter(o => o.id === row.festival && o.date >= td).map(o => o.date).sort()[0];
      if (d) return { row, f, pack, date: d, loc };
    }
    return null;
  })();
  p.catch(() => TFEST.delete(key)); TFEST.set(key, p); return p;
}
const packName = (pack, f) => f.names[X.lang()] ?? f.names.en;
async function viewKula(main) {
  X.loading();
  const T = await temples(); T.temples.forEach(x => TEMPLE_NAMES.set(x.id, x.name));
  PRAYERS ??= await X.loadPrayers().catch(() => null);
  if (X.tab() !== 'family' || FAM.screen !== 'kula') return;
  const draw = async (pop) => {
    const F = doc(), k = F.kula, D = k && DEITY[k.deity], own = ownOf(k), term = kulaTerm();
    const filt = D ? T.temples.filter(x => (k.deity === 'guruvayurappan' ? GURUVAYUR.includes(x.id) || D.temples.includes(x.deity) : D.temples.includes(x.deity)))
      .sort((a, b) => X.kmFrom(X.S.home, a) - X.kmFrom(X.S.home, b)).slice(0, 6) : [];
    const tp = k?.temple, tpRow = tp?.id ? T.temples.find(x => x.id === tp.id) : null;
    if (tpRow && !filt.some(x => x.id === tpRow.id)) filt.unshift(tpRow);
    const kp = kulaPrayers(PRAYERS);
    main.innerHTML = `<div class="fm">${back()}<div class="fm-title"><span class="small muted">${esc(t('fam.kula.sub'))}</span><h2 class="serif">${esc(term)}</h2></div>
      <section class="fm-sec"><span class="fm-eyebrow">${esc(t('fam.kula.deity'))}</span><div class="fm-chips">${DEITIES.map(([d, label, , , icon]) => `<button class="fm-chip" data-kd="${d}" aria-pressed="${k?.deity === d}">${X.deityIcon(icon, 14)} ${esc(t(label))}</button>`).join('')}<button class="fm-chip" data-kown aria-pressed="${!!own}">＋ ${esc(own ? ownFull(own) : t('fam.kula.own'))}</button></div></section>
      ${!k || (k.deity === 'custom' && !own) ? `<p class="muted">${esc(t('fam.kula.none'))}</p></div>` : `
      ${own ? `<div class="card fm-own"><div class="fm-sec-top"><span class="grow"><b class="serif">${esc(own.name)}</b>${own.altName ? ` <span class="small muted">${esc(own.altName)}</span>` : ''}</span><button class="btn soft fm-sm" data-kedit>${esc(t('c.edit'))}</button></div>
        ${kulaTempleLabel(k) ? `<p class="small muted" style="margin:2px 0 0">${esc(t('fam.kula.oTemple'))}: ${esc(kulaTempleLabel(k))}</p>` : ''}</div>` : `<section class="fm-sec"><span class="fm-eyebrow">${esc(t('fam.kula.temple'))}</span><div class="fm-chips">${filt.map(x => `<button class="fm-chip" data-kt="${esc(x.id)}" aria-pressed="${tp?.id === x.id}">${esc(x.name)}</button>`).join('')}
        ${tp && !tp.id ? `<button class="fm-chip" aria-pressed="true" data-ktyped>${esc(templeLabel(tp))}</button>` : ''}<button class="fm-chip" data-kother>${esc(t('fam.kula.templeOther'))}</button></div></section>`}
      <div class="card fm-kcard"><div class="fm-sec-top"><span class="fm-sec-h serif">${esc(X.dtf({ month: 'long', year: 'numeric', timeZone: 'UTC' }).format(X.parse(X.today())))}</span><span class="small muted">◯ ${esc(t('fam.kula.legend', deityName(k.deity)))}</span></div>
        <p class="small muted" style="margin:2px 0 8px">${esc(own ? own.rules.map(ruleText).join(' · ') : t('fam.kula.rule.' + (k.deity === 'bhagavathi' ? 'devi' : k.deity)))}</p>
        <div class="fm-cal" data-kcal><p class="small muted">…</p></div><div class="fm-daynote" data-knote aria-live="polite">${esc(t('fam.kula.tapDay'))}</div></div>
      <div class="card"><div class="fm-switch"><span id="fmkoc">${esc(t('fam.kula.onCalendar'))}<span class="small muted">${esc(t('fam.kula.onCalendarNote', deityName(k.deity)))}</span></span>${sw(k.onCalendar, 'fmkocs', 'fmkoc')}</div></div>
      <div data-ktf></div>
      <section class="fm-sec"><span class="fm-sec-h serif">${esc(t('py.title'))}</span>${kp?.prayers.length ? `<div class="fm-plist">${kp.prayers.map((p, i) => `<button data-kpr="${esc(p.id)}"><span>${esc(X.prayerTitle(p))}${i === 0 ? ` <span class="fm-tag gold">${esc(t('fam.kula.oursT', term))}</span>` : ''}</span><span aria-hidden="true">›</span></button>`).join('')}</div>` : `<p class="small muted">${esc(own ? t('fam.kula.oNoPrayers') : t('fam.kula.noPrayers', deityName(k.deity)))}</p>`}</section>
      <button class="linkbtn" data-kclear>${esc(own ? t('fam.kula.delOwn') : t('fam.kula.clearT', term))}</button></div>`}`;
    main.querySelector('[data-fback]').onclick = () => go('hub');
    const save = (fields) => { const F2 = doc(); F2.kula = F2.kula ? touch({ ...F2.kula, ...fields }) : rec({ deity: null, temple: null, onCalendar: true, ...fields }); persist(); };
    main.querySelectorAll('[data-kd]').forEach(b => b.onclick = () => { const d = b.dataset.kd; if (k?.deity === d) return; save({ deity: d }); draw(true); });
    main.querySelector('[data-kown]').onclick = () => ownEditor(() => draw(true));
    if (!k || (k.deity === 'custom' && !own)) return;
    main.querySelector('[data-kedit]')?.addEventListener('click', () => ownEditor(() => draw(true)));
    main.querySelectorAll('[data-kt]').forEach(b => b.onclick = () => { save({ temple: tp?.id === b.dataset.kt ? null : { id: b.dataset.kt } }); draw(); });
    main.querySelector('[data-ktyped]')?.addEventListener('click', () => { save({ temple: null }); draw(); });
    main.querySelector('[data-kother]')?.addEventListener('click', () => () => templeSearch(T, x => { save({ temple: x }); draw(); }));
    main.querySelector('#fmkocs').onclick = () => { save({ onCalendar: !k.onCalendar }); draw(); };
    main.querySelector('[data-kclear]').onclick = () => own ? confirmSheet(t('fam.kula.delOwn'), ownFull(own), t('fam.delete'), () => { doc().kula = null; persist(); draw(); }) : (doc().kula = null, persist(), draw());
    main.querySelectorAll('[data-kpr]').forEach(b => b.onclick = () => X.openPrayer(b.dataset.kpr));
    kulaMonth(main.querySelector('[data-kcal]'), main.querySelector('[data-knote]'), k.deity, pop && !X.still());
    if (own) ownTempleCard(main.querySelector('[data-ktf]'), own); else templeCard(main.querySelector('[data-ktf]'), tpRow, tp);
  };
  draw();
}
const WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const wdShort = k => { const n = X.name('weekdays', k); return X.lang() === 'en' ? n.slice(0, 2) : [...new Intl.Segmenter().segment(n)][0]?.segment || n; };
async function kulaMonth(el, note, deity, pop) {
  const td = X.today(), m0 = td.slice(0, 8) + '01', [y, mo] = m0.split('-').map(Number), last = `${y}-${String(mo).padStart(2, '0')}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, '0')}`;
  const [cells, marks] = await Promise.all([cellsRange(m0, last, X.S.home), kulaMarks(m0, last, X.S.home, deity)]);
  if (!el.isConnected) return;
  el.innerHTML = WD.map(w => `<span class="dow">${esc(wdShort(w))}</span>`).join('') + '<span></span>'.repeat(X.parse(m0).getUTCDay()) + cells.map(c => {
    const r = marks.get(c.date), major = (c.festivals || []).some(id => X.festById(id)?.tier === 'major');
    return `<button class="fm-d${r ? ' kr' + (pop ? ' kpop' : '') : ''}${c.date === td ? ' ktoday' : ''}${major ? ' kfest' : ''}" ${r ? `data-kday="${c.date}"` : 'tabindex="-1"'} aria-label="${esc(X.greg(c.date) + (r ? ', ' + kulaNoteFor(c.date, r, deity) : ''))}">${+c.date.slice(8)}</button>`;
  }).join('');
  el.querySelectorAll('[data-kday]').forEach(b => b.onclick = () => { note.textContent = kulaNoteFor(b.dataset.kday, marks.get(b.dataset.kday), deity); });
}
const kulaNoteFor = (d, r, deity) => t('fam.kula.dayNote', shortDate(d), r, deityName(deity));
async function templeCard(el, row, tp) {
  if (!tp) { el.innerHTML = ''; return; }
  if (!row) { el.innerHTML = `<p class="small muted">${esc(t('fam.kula.noFestival', templeLabel(tp)))}</p>`; return; }
  el.innerHTML = `<p class="small muted">${esc(t('fam.clock.reading'))}</p>`;
  const r = await templeFestival(row).catch(() => null);
  if (!el.isConnected) return;
  if (!r) { el.innerHTML = `<p class="small muted">${esc(t('fam.kula.noFestival', row.name))}</p>`; return; }
  const nm = packName(r.pack, r.f), dateText = X.greg(r.date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }), deity = deityName(doc().kula?.deity);
  el.innerHTML = `<div class="fm-temple"><span class="fm-eyebrow">${esc(t('fam.kula.festival'))}</span><h3 class="serif">${esc(nm)}</h3>
    <span class="fm-when">${esc(t('fam.kula.festivalWhen', dateText, row.place))}</span>${r.row.culture !== X.S.culture ? `<span class="small" style="opacity:.85">${esc(t('fam.kula.festivalBy', cultureName(r.row.culture)))}</span>` : ''}
    <button class="fm-pill gold" data-tshare>${X.SHARE_ICON} ${esc(t('fam.kula.shareFam'))}</button></div>`;
  el.querySelector('[data-tshare]').onclick = async e => {
    e.currentTarget.disabled = true;
    const f = { id: r.f.id, card: r.f.card || 'diya', names: { en: nm }, content: {} };
    const design = X.REGION_STYLE[r.row.culture] || 'heritage';
    try {
      const png = await X.cardImage(f, null, { p: X.cardPalette(f.card), to: '', from: deity, msg: '', lang: X.lang(), design, motion: 'still', words: { title: nm, sub: row.name, kicker: t('fam.kula.festival'), from: deity } }, '', `${dateText} · ${row.place}`);
      await shareFiles([new File([png], `${r.f.id}-temple.png`, { type: 'image/png' })], t('fam.kula.shareText', nm, row.name, dateText), nm);
    } catch { X.toast(t('fam.err.file')); }
    if (el.isConnected) el.querySelector('[data-tshare]').disabled = false;
  };
}
function templeSearch(T, done) {
  const o = X.sheet(`<h2 class="serif">${esc(t('fam.kula.temple'))}</h2><input class="search" id="fmts" placeholder="${esc(t('tm.search'))}" aria-label="${esc(t('tm.search'))}"><div id="fmtr" class="fm-tresults"></div>
    <details class="fm-typed"><summary>${esc(t('fam.kula.templeTyped'))}</summary>
      <label class="field"><span>${esc(t('fam.kula.templeName'))}</span><input type="text" id="fmtn" maxlength="120"></label>
      <label class="field"><span>${esc(t('fam.kula.templePlace'))}</span><input type="text" id="fmtp" maxlength="120"></label>
      <button class="btn block" data-tsave>${esc(t('c.save'))}</button></details>`);
  const list = () => {
    const q = o.querySelector('#fmts').value.trim().toLowerCase();
    const xs = (q ? T.temples.filter(x => x.name.toLowerCase().includes(q) || x.place.toLowerCase().includes(q)) : T.temples.slice().sort((a, b) => X.kmFrom(X.S.home, a) - X.kmFrom(X.S.home, b))).slice(0, 40);
    o.querySelector('#fmtr').innerHTML = xs.map(x => `<button class="fm-lrow" data-tid="${esc(x.id)}"><span class="grow"><b>${esc(x.name)}</b><span class="small muted">${esc(x.place)}</span></span>${X.deityIcon(x.deity, 16)}</button>`).join('');
    o.querySelectorAll('[data-tid]').forEach(b => b.onclick = () => { o.remove(); done({ id: b.dataset.tid }); });
  };
  o.querySelector('#fmts').oninput = list; list();
  o.querySelector('[data-tsave]').onclick = () => { const n = o.querySelector('#fmtn').value.trim(); if (!n) return o.querySelector('#fmtn').focus(); o.remove(); done({ name: n, place: o.querySelector('#fmtp').value.trim() }); };
  setTimeout(() => o.querySelector('#fmts').focus(), 50);
}

// ---------------------------------------------------------------- our two traditions
export const secondOn = () => !!(doc().second?.culture && doc().second.onCalendar);
export const secondName = () => doc().second?.culture ? cultureName(doc().second.culture) : '';
export const secondLegend = () => `<span><i class="fm-sdot"></i>${esc(t('fam.two.legend', secondName()))}</span>`;
// The second tradition's major and regional festivals at home, from..to: the name in English and in its own script.
export async function overlayFor(from, to) {
  const sc = doc().second; if (!sc?.culture) return [];
  const { json, pack } = await packOf(sc.culture), out = [];
  for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) {
    for (const o of await X.engine({ op: 'festivals', handle: await openWith(y, X.S.home, sc.culture, json) })) {
      if (o.date < from || o.date > to) continue;
      const f = pack.festivals.find(x => x.id === o.id);
      if (f && !f.hidden && f.tier !== 'minor') out.push({ date: o.date, id: o.id, en: f.names.en, native: f.names[pack.language] && f.names[pack.language] !== f.names.en ? f.names[pack.language] : '', lang: pack.language, f });
    }
  }
  return out.sort((a, b) => a.date < b.date ? -1 : 1);
}
export const secondLabel = x => `<span class="fm-s2">${esc(x.en)}</span>${x.native ? ` <span class="fm-s2n" lang="${esc(x.lang)}">${esc(x.native)}</span>` : ''}`;

// ---------------------------------------------------------------- family clock
let clockTick = null;
async function viewClock(main) {
  X.loading();
  const td = X.today();
  const F0 = (await X.upcoming(td, 400).catch(() => [])).find(x => x.f.tier === 'major') || null;
  if (X.tab() !== 'family' || FAM.screen !== 'clock') return;
  const F = doc(), away = X.awayPlace();
  const places = [{ kind: 'home', place: X.S.home, label: t('dual.home'), person: selfName() },
    ...(away ? [{ kind: 'away', place: away, label: t('dual.away'), person: '' }] : []),
    ...F.cities.map(c => ({ kind: 'city', id: c.id, place: c.place, label: '', person: c.person }))];
  const nowLine = p => t('fam.clock.now', X.dtf({ weekday: 'short', timeZone: p.place.tz }).format(new Date()));
  main.innerHTML = `<div class="fm">${back()}<div class="fm-title"><span class="small muted">${esc(F0 ? t('fam.clock.sub', X.fname(F0.f)) : t('fam.clock.subPlain'))}</span><h2 class="serif">${esc(t('fam.clock.title'))}</h2></div>
    <div class="fm-cities">${places.map((p, i) => `<div class="fm-city" data-ci="${i}"><div class="fm-cityhead"><span class="cn">${esc(p.place.name)}</span>${p.kind === 'city' ? `<button class="fm-more" data-cmore="${esc(p.id)}" aria-label="${esc(t('fam.remove'))}: ${esc(p.place.name)}">⋯</button>` : ''}</div>
      <span class="small muted">${esc([p.label, p.person].filter(Boolean).join(' · '))}</span>
      <span class="clk serif" data-clk="${i}">${esc(X.clockIn(Date.now() / 1000, p.place.tz))}</span><span class="wk" data-wk="${i}">${esc(nowLine(p))}</span>
      ${F0 ? `<div class="ev" data-ev="${i}"><span class="small muted">${esc(t('fam.clock.reading'))}</span></div>` : ''}</div>`).join('')}</div>
    ${F.cities.length < LIMIT.cities ? `<button class="btn soft block" data-cadd>＋ ${esc(t('fam.clock.addCity'))}</button>` : `<p class="small muted">${esc(t('fam.clock.cityLimit', LIMIT.cities))}</p>`}
    <p class="small muted">${esc(t('fam.clock.why'))}</p>
    <div data-two></div>
    <section class="fm-sec"><div class="fm-chiprow"><button class="fm-chip" data-plan aria-pressed="false">${esc(t('fam.call.plan'))}</button><span class="small muted">${esc(t('fam.call.hint'))}</span></div><div data-planout hidden></div></section></div>`;
  main.querySelector('[data-fback]').onclick = () => go('hub');
  clearInterval(clockTick);
  clockTick = setInterval(() => {
    if (!main.isConnected || X.tab() !== 'family' || FAM.screen !== 'clock' || !main.querySelector('[data-clk]')) return clearInterval(clockTick);
    places.forEach((p, i) => { const c = main.querySelector(`[data-clk="${i}"]`), w = main.querySelector(`[data-wk="${i}"]`); if (c) c.textContent = X.clockIn(Date.now() / 1000, p.place.tz); if (w) w.textContent = nowLine(p); });
  }, 15000);
  main.querySelector('[data-cadd]')?.addEventListener('click', () => addCity(() => viewClock(main).then(() => main.querySelector('[data-fback]').onclick = () => go('hub'))));
  main.querySelectorAll('[data-cmore]').forEach(b => {
    const open = (x, y) => { const c = doc().cities.find(z => z.id === b.dataset.cmore); if (!c) return;
      X.popMenu(x, y, [{ label: t('fam.remove'), icon: 'info', fn: () => confirmSheet(t('fam.clock.removeCity', c.place.name), '', t('fam.remove'), () => {
        doc().cities = doc().cities.filter(z => z.id !== c.id); tomb(c.id); persist(); viewClock(main); }) }]); };
    b.onclick = e => { const r = b.getBoundingClientRect(); open(r.left, r.bottom); e.stopPropagation(); };
    X.onHold(b.closest('.fm-city'), open);
  });
  twoCard(main.querySelector('[data-two]'));
  const planBtn = main.querySelector('[data-plan]'), out = main.querySelector('[data-planout]');
  planBtn.onclick = () => { const on = planBtn.getAttribute('aria-pressed') !== 'true'; planBtn.setAttribute('aria-pressed', on); out.hidden = !on; if (on) planner(out, places, F0); };
  // Each city's day for the festival, read with the user's own tradition: the home calendar first.
  if (F0) places.forEach(async (p, i) => {
    const el = main.querySelector(`[data-ev="${i}"]`);
    try {
      const d = p.kind === 'home' ? F0.date : X.nearestDate((await X.awayIndex(F0.date, F0.date, p.place)).get(F0.f.id), F0.date);
      if (!el.isConnected) return;
      if (!d) { el.innerHTML = `<b>${esc(X.fname(F0.f))}</b><span class="small muted">${esc(t('ha.none'))}</span>`; return; }
      const w = await X.engine({ op: 'window', handle: await X.cal(+d.slice(0, 4), p.place), id: F0.f.id, date: d }).catch(() => null);
      const at = u => X.clockIn(u, p.place.tz);
      const win = w ? (w.start === w.end ? `${t('k.' + w.kala)} · ${at(w.start)}` : `${at(w.start)} – ${at(w.end)}`) : '';
      el.innerHTML = `<b>${esc(X.fname(F0.f))}</b><span>${esc(shortDate(d))}</span>${win ? `<span class="small muted">${esc(win)}</span>` : ''}${p.kind !== 'home' ? `<span class="fm-early">${esc(X.relation(F0.date, d))}</span>` : ''}`;
    } catch { if (el?.isConnected) el.innerHTML = `<span class="small muted">${esc(t('ha.none'))}</span>`; }
  });
}
function addCity(done) {
  const o = X.sheet(`<h2 class="serif">${esc(t('fam.clock.addCity'))}</h2><div id="fmcp"></div>`, o => X.placePicker(o.querySelector('#fmcp'), place => {
    o.remove();
    const people = X.S.people.filter(p => p.name);
    const w = X.sheet(`<h2 class="serif">${esc(place.name)}</h2><label class="field"><span>${esc(t('fam.clock.who'))}</span>
      ${people.length ? `<select id="fmcwp" aria-label="${esc(t('fam.voice.fromPeople'))}"><option value="">${esc(t('fam.voice.fromPeople'))}</option>${people.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>` : ''}
      <input type="text" id="fmcw" maxlength="40" placeholder="${esc(t('fam.clock.whoHint'))}" style="margin-top:6px"></label>
      <div class="fm-btns"><button class="btn soft" data-no>${esc(t('c.cancel'))}</button><button class="btn" data-yes>${esc(t('c.add'))}</button></div>`);
    let pid = null;
    w.querySelector('#fmcwp')?.addEventListener('change', e => { pid = e.target.value || null; const p = X.S.people.find(x => x.id === pid); if (p) w.querySelector('#fmcw').value = p.name; });
    w.querySelector('[data-no]').onclick = () => w.remove();
    w.querySelector('[data-yes]').onclick = () => {
      const F = doc(); if (F.cities.length >= LIMIT.cities) return w.remove();
      F.cities.push(rec({ person: w.querySelector('#fmcw').value.trim(), personId: pid, place, culture: null })); persist(); w.remove(); done();
    };
  }));
  return o;
}
async function twoCard(el) {
  const F = doc(), sc = F.second, own = cultureName(X.S.culture);
  el.innerHTML = `<div class="card"><div class="fm-switch"><span id="fmtwo">${esc(t('fam.two.title'))}<span class="small muted">${esc(sc?.culture ? t('fam.two.sub', own, cultureName(sc.culture)) : t('fam.two.none'))}</span></span>${sw(!!sc, 'fmtwos', 'fmtwo')}</div>
    ${sc ? `<label class="field"><span>${esc(t('fam.two.choose'))}</span><select id="fmtwoc"><option value="">—</option>${X.CULTURES.filter(c => c.id !== X.S.culture).map(c => `<option value="${c.id}" ${sc.culture === c.id ? 'selected' : ''}>${esc(X.S.native ? c.native : c.en)}</option>`).join('')}</select></label>
      ${sc.culture ? `<div class="fm-switch"><span id="fmtwoo">${esc(t('fam.two.onCalendar'))}<span class="small muted">${esc(t('fam.two.onCalendarNote'))}</span></span>${sw(sc.onCalendar, 'fmtwoos', 'fmtwoo')}</div>` : ''}` : ''}</div>
    ${sc?.culture ? `<div class="card" data-twomonth><p class="small muted">${esc(t('fam.two.reading', cultureName(sc.culture)))}</p></div>` : ''}`;
  const set = v => { doc().second = v; persist(); twoCard(el); };
  el.querySelector('#fmtwos').onclick = () => set(sc ? null : { culture: '', onCalendar: false, modified: nowISO() });
  el.querySelector('#fmtwoc')?.addEventListener('change', e => set({ ...sc, culture: e.target.value, modified: nowISO() }));
  el.querySelector('#fmtwoos')?.addEventListener('click', () => set({ ...sc, onCalendar: !sc.onCalendar, modified: nowISO() }));
  const box = el.querySelector('[data-twomonth]'); if (!box) return;
  const td = X.today(), m0 = td.slice(0, 8) + '01', [y, mo] = m0.split('-').map(Number), last = `${y}-${String(mo).padStart(2, '0')}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, '0')}`;
  try {
    const [cells, two] = await Promise.all([cellsRange(m0, last, X.S.home), overlayFor(m0, last)]);
    if (!box.isConnected) return;
    const ownBy = new Map(), list = [];
    for (const c of cells) for (const id of c.festivals || []) { const f = X.festById(id); if (f && !f.hidden && f.tier !== 'minor') { ownBy.set(c.date, true); list.push({ date: c.date, own: true, html: esc(X.fname(f)) + (X.fother(f) ? ` <span class="small muted">${esc(X.fother(f))}</span>` : '') }); } }
    const twoBy = new Set(two.map(x => x.date)); two.forEach(x => list.push({ date: x.date, own: false, html: secondLabel(x) }));
    list.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.own ? -1 : 1);
    box.innerHTML = `<div class="fm-sec-top"><span class="fm-sec-h serif">${esc(X.dtf({ month: 'long', year: 'numeric', timeZone: 'UTC' }).format(X.parse(m0)))}</span>
      <span class="fm-legend2"><span><i style="background:var(--fm-clay)"></i>${esc(own)}</span><span><i style="background:var(--fm-bengal)"></i>${esc(cultureName(doc().second.culture))}</span></span></div>
      <div class="fm-cal">${WD.map(w => `<span class="dow">${esc(wdShort(w))}</span>`).join('')}${'<span></span>'.repeat(X.parse(m0).getUTCDay())}${cells.map(c => `<span class="fm-d${c.date === td ? ' ktoday' : ''}">${+c.date.slice(8)}${ownBy.has(c.date) || twoBy.has(c.date) ? `<span class="fm-dots">${ownBy.has(c.date) ? '<b style="background:var(--fm-clay)"></b>' : ''}${twoBy.has(c.date) ? '<b style="background:var(--fm-bengal)"></b>' : ''}</span>` : ''}</span>`).join('')}</div>
      <div class="fm-flist">${list.map(x => `<div class="${x.own ? '' : 'two'}"><span class="dt">${esc(X.dtf({ day: 'numeric', month: 'short', timeZone: 'UTC' }).format(X.parse(x.date)))}</span><span class="nm">${x.html}</span></div>`).join('')}</div>`;
  } catch { if (box.isConnected) box.innerHTML = `<p class="small muted">${esc(t('ha.none'))}</p>`; }
}
// The local date and minute of the day of a moment in a time zone.
const LFMT = new Map();
function local(u, tz) {
  let f = LFMT.get(tz); if (!f) LFMT.set(tz, f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
  const p = Object.fromEntries(f.formatToParts(new Date(u * 1000)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute };
}
// An hour that is daytime everywhere: every half hour of the home day, the one with the widest margin from 8 am
// and 10 pm in every place; if none fits, the one least outside those hours.
export function findCall(tzs, D, homeTz) {
  const a = X.zonedUnix(D, '00:00', homeTz) - 14 * 3600, b = X.zonedUnix(X.addDays(D, 1), '00:00', homeTz) + 14 * 3600;
  let best = null, closest = null;
  for (let u = a; u < b; u += 1800) {
    if (local(u, homeTz).date !== D) continue;
    let margin = Infinity, outside = 0, fits = true;
    for (const tz of tzs) {
      const s = local(u, tz).min, e = s + 60;
      if (s < 480 || e > 1320) fits = false;
      margin = Math.min(margin, s - 480, 1320 - e);
      outside += 60 - Math.max(0, Math.min(e, 1320) - Math.max(s, 480));
    }
    if (fits && (!best || margin > best.margin)) best = { u, margin };
    if (!closest || outside < closest.outside) closest = { u, outside };
  }
  return best ? { u: best.u, fits: true } : closest ? { u: closest.u, fits: false } : null;
}
function planner(out, places, F0) {
  const td = X.today(), tzs = [...new Set(places.map(p => p.place.tz))];
  if (tzs.length < 2) { out.innerHTML = `<div class="card"><p class="small muted" style="margin:0">${esc(t('fam.call.needTwo'))}</p></div>`; return; }
  const eve = F0 && X.daysBetween(td, F0.date) <= 30 && X.daysBetween(td, F0.date) >= 1 ? X.addDays(F0.date, -1) : null;
  let D = eve || td;
  const draw = () => {
    const r = findCall(tzs, D, X.S.home.tz); if (!r) return;
    const rows = places.map(p => ({ p, l: local(r.u, p.place.tz), time: X.clockIn(r.u, p.place.tz), day: X.dtf({ weekday: 'short', day: 'numeric', month: 'short', timeZone: p.place.tz }).format(new Date(r.u * 1000)) }));
    const first = rows.slice().sort((a, b) => a.l.min - b.l.min)[0], groups = new Map();
    for (const x of rows) if (x !== first) { const k = x.l.date === first.l.date ? x.time : `${x.day}, ${x.time}`; groups.set(k, [...(groups.get(k) || []), x.p.place.name]); }
    const head = t('fam.call.slot', first.day, first.time, first.p.place.name);
    const others = [...groups].map(([tm, ns]) => t('fam.call.others', tm, ns.join(', '))).join(' · ');
    const axis = h => X.dtf({ hour: 'numeric', minute: '2-digit', ...X.hourOpts(), timeZone: 'UTC' }).format(new Date(Date.UTC(2020, 0, 1, h)));
    const chips = [...(eve ? [[eve, t('fam.call.dayBefore', X.fname(F0.f))]] : []), [td, t('day.today')], [X.addDays(td, 1), t('day.tomorrow')]];
    const seen = new Set();
    out.innerHTML = `<div class="card fm-plan"><div class="fm-chips">${chips.filter(([d]) => !seen.has(d) && seen.add(d)).map(([d, l]) => `<button class="fm-chip" data-pd="${d}" aria-pressed="${d === D}">${esc(l)}</button>`).join('')}</div>
      <div class="fm-slot" aria-live="polite"><b class="serif">${esc(head)}</b>${others ? `<span>${esc(others)}</span>` : ''}</div>
      ${r.fits ? '' : `<p class="small fm-warn">${esc(t('fam.call.none'))}</p>`}
      <div class="fm-bands" aria-hidden="true">${rows.map(x => `<div class="fm-band"><span>${esc(x.p.place.name)}</span><div class="fm-bar"><i style="left:${(480 / 1440 * 100).toFixed(2)}%;width:${(840 / 1440 * 100).toFixed(2)}%"></i><em style="left:${(x.l.min / 1440 * 100).toFixed(2)}%;width:${(60 / 1440 * 100).toFixed(2)}%"></em></div></div>`).join('')}
        <div class="fm-band axis"><span></span><div class="ax"><span>${esc(axis(0))}</span><span>${esc(axis(12))}</span><span>${esc(axis(0))}</span></div></div></div>
      <p class="small muted">${esc(t('fam.call.legend'))}</p>
      <button class="btn" data-psend>${X.SHARE_ICON} ${esc(t('fam.call.send'))}</button></div>`;
    out.querySelectorAll('[data-pd]').forEach(b => b.onclick = () => { D = b.dataset.pd; draw(); });
    out.querySelector('[data-psend]').onclick = () => shareText([t('fam.call.shareHead', D === eve ? t('fam.call.dayBefore', X.fname(F0.f)) : X.greg(D)), ...rows.map(x => t('fam.call.shareLine', x.p.place.name, `${x.day}, ${x.time}`))].join('\n'), t('fam.call.plan'));
  };
  draw();
}
