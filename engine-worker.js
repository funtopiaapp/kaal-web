// Runs the Kaal engine (kaal_wasm.wasm) off the main thread: a year takes a
// second or two to compute, and the page stays responsive meanwhile.
let x = null;
const ready = WebAssembly.instantiateStreaming(fetch('kaal_wasm.wasm?v=202610310957'), {})
  .catch(() => fetch('kaal_wasm.wasm?v=202610310957').then(r => r.arrayBuffer()).then(b => WebAssembly.instantiate(b, {})))
  .then(r => { x = r.instance.exports; });

function call(req) {
  const enc = new TextEncoder().encode(JSON.stringify(req));
  const p = x.kaal_alloc(enc.length);
  new Uint8Array(x.memory.buffer, p, enc.length).set(enc);
  const r = x.kaal_call(p, enc.length);
  x.kaal_free(p, enc.length);
  const len = new DataView(x.memory.buffer).getUint32(r, true);
  const out = new TextDecoder().decode(new Uint8Array(x.memory.buffer, r + 4, len).slice());
  x.kaal_free(r, 4 + len);
  return JSON.parse(out);
}

// A year's table (the sky computed for a place) is kept in this browser, as the app keeps it on the phone, so a
// launch reads it instead of computing it again. Kept under the engine's table format, the year and the place;
// the engine still checks a stored table is for that year and place. Only last year to next year are kept.
// Storage that is blocked or fails only costs the time to compute.
let dbp = null;
const db = () => dbp ??= new Promise((res, rej) => {
  const r = indexedDB.open('kaal-tables', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('t');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
}).catch(() => null);
const asked = q => new Promise(res => { q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
const tableKey = (f, req) => { const l = req.location || {}; return `v${f}|${req.year}|${(+l.latitude).toFixed(5)}|${(+l.longitude).toFixed(5)}|${l.tz}`; };
async function storedTable(key) {
  try {
    const d = await Promise.race([db(), new Promise(r => setTimeout(r, 1000))]);
    return d ? (await asked(d.transaction('t').objectStore('t').get(key)))?.table ?? null : null;
  } catch { return null; }
}
async function keepTable(key, year, table) {
  try {
    const now = new Date().getUTCFullYear();
    if (year < now - 1 || year > now + 1) return;
    const d = await db(); if (!d) return;
    const st = d.transaction('t', 'readwrite').objectStore('t');
    st.put({ table, year, at: Date.now() }, key);
    // Old years go, and no more than a dozen tables stay (the newest).
    const keys = await asked(st.getAllKeys()) || [], all = await asked(st.getAll()) || [];
    const rows = keys.map((k, i) => ({ k, ...all[i] })).filter(r => r.k !== key).sort((a, b) => b.at - a.at);
    rows.forEach((r, i) => { if (r.year < now - 1 || r.year > now + 1 || i >= 11) st.delete(r.k); });
  } catch {}
}

self.onmessage = async e => {
  const { id, req } = e.data;
  try { await ready; } catch (err) { self.postMessage({ id, res: { error: 'engine failed to load', fatal: true } }); return; }
  try {
    if (req.op !== 'open') { self.postMessage({ id, res: call(req) }); return; }
    let key = null;
    try { key = tableKey(call({ op: 'tableFormat' }).ok, req); } catch {}
    const table = key && await storedTable(key);
    const res = call(table ? { ...req, table } : req);
    if (res.ok?.table) { if (key) keepTable(key, req.year, res.ok.table); delete res.ok.table; }
    self.postMessage({ id, res });
  }
  // A wasm trap (a panic) can leave the instance half-way through a call; the page starts a fresh worker.
  catch (err) { self.postMessage({ id, res: { error: String(err), fatal: err instanceof WebAssembly.RuntimeError } }); }
};
