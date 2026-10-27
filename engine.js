// Promise wrapper over the engine workers: `await engine({op: 'day', ...})`.
// Two lanes, so one slow job never holds up the rest: birth details (anchor,
// jataka, matching) need no calendar handle and run on their own worker. A job
// that errors the worker or runs past its time limit restarts that worker and
// fails with an error the screen can show, and the queue behind it carries on.
const BIRTH = new Set(['anchor', 'jataka', 'poruthamMatch']);
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
    worker = new Worker('engine-worker.js?v=202610271849');
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
  return req => {
    if (!worker) start();
    const id = next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { if (waiting.has(id)) fail('engine timed out'); }, LIMIT[req.op] || 30000);
      waiting.set(id, { resolve, reject, timer });
      worker.postMessage({ id, req });
    });
  };
}
const main = lane('main'), birth = lane('birth');
export function engine(req) { return (BIRTH.has(req.op) ? birth : main)(req); }
