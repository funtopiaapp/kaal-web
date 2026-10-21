// Runs the Kaal engine (kaal_wasm.wasm) off the main thread: a year takes a
// second or two to compute, and the page stays responsive meanwhile.
let x = null;
const ready = WebAssembly.instantiateStreaming(fetch('kaal_wasm.wasm'), {}).then(r => { x = r.instance.exports; });

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

self.onmessage = async e => {
  await ready;
  const { id, req } = e.data;
  try { self.postMessage({ id, res: call(req) }); }
  catch (err) { self.postMessage({ id, res: { error: String(err) } }); }
};
