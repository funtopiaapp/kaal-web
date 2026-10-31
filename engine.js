// Promise wrapper over the engine workers: `await engine({op: 'day', ...})`.
// Lanes, so one slow job never holds up the rest: birth details (anchor,
// jataka, matching) and the year's sky need no calendar handle and run on their
// own worker; calendars open on two workers, so two years are read at once
// (a handle names its worker: 2 × the worker's own handle + which one). A job
// that errors the worker or runs past its time limit restarts that worker and
// fails with an error the screen can show, and the queue behind it carries on.
const BIRTH = new Set(['anchor', 'jataka', 'poruthamMatch', 'sky']);
const LIMIT = { muhurtham: 90000, anchor: 20000, jataka: 20000, poruthamMatch: 30000 };
const restarted = [];
export function onRestart(fn) { restarted.push(fn); }

function lane(name) {
  let worker = null, next = 1;
  const waiting = new Map();
  const fail = (why) => {
    worker?.terminate(); worker = null;
    for (const w of waiting.values()) { clearTimeout(w.timer); w.reject(new Error(why)); }
    waiting.clear();
    // Calendar handles lived in the old worker; the app opens them again.
    if (name === 'main') restarted.forEach(fn => fn());
  };
  const start = () => {
    worker = new Worker('engine-worker.js?v=202610310832');
    worker.onmessage = e => {
      const { id, res } = e.data;
      const w = waiting.get(id); if (!w) return;
      waiting.delete(id); clearTimeout(w.timer);
      if (res.error) w.reject(new Error(res.error)); else w.resolve(res.ok);
      // A trap leaves the wasm instance unusable: start a clean one.
      if (res.fatal) fail('engine restarted');
    };
    worker.onerror = e => { e.preventDefault?.(); fail('engine error'); };
    worker.onmessageerror = () => fail('engine error');
  };
  const run = req => {
    if (!worker) start();
    const id = next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { if (waiting.has(id)) fail('engine timed out'); }, LIMIT[req.op] || 30000);
      waiting.set(id, { resolve, reject, timer });
      worker.postMessage({ id, req });
    });
  };
  run.busy = () => waiting.size;
  run.warm = () => { if (!worker) start(); };
  return run;
}
const cals = [lane('main'), lane('main')], birth = lane('birth');
// The calendar workers fetch and compile the engine while the page reads its text and pack.
export function warm() { cals.forEach(c => c.warm()); }
export function engine(req) {
  if (BIRTH.has(req.op)) return birth(req);
  // A new year goes to the calendar worker with less to do.
  if (req.op === 'open') { const k = cals[1].busy() < cals[0].busy() ? 1 : 0; return cals[k](req).then(r => ({ ...r, handle: r.handle * 2 + k })); }
  if (req.handle == null) return cals[0](req);
  const k = req.handle % 2;
  return cals[k]({ ...req, handle: (req.handle - k) / 2 });
}
