// Promise wrapper over the engine worker: `await engine({op: 'day', ...})`.
const worker = new Worker('engine-worker.js');
let next = 1;
const waiting = new Map();
worker.onmessage = e => {
  const { id, res } = e.data;
  const w = waiting.get(id); waiting.delete(id);
  if (res.error) w.reject(new Error(res.error)); else w.resolve(res.ok);
};
export function engine(req) {
  const id = next++;
  return new Promise((resolve, reject) => { waiting.set(id, { resolve, reject }); worker.postMessage({ id, req }); });
}
