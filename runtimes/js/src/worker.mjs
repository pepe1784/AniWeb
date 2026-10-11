// Worker entry for JS runtime
// Protocol: {type:'load', code, id} -> loads and wraps Source class; {type:'call', method, args} -> calls adapted method

import { adaptSource } from './adapter.mjs';
import { createClientShim, createCryptoShim } from './shims.mjs';

let adapted = null;

self.onmessage = async (e) => {
  const msg = e.data;
  if (!msg || typeof msg !== 'object') return;
  
  try {
    if (msg.type === 'load') {
      // msg.code contains source class definition
      const blob = new Blob([msg.code], { type: 'text/javascript' });
      const moduleUrl = URL.createObjectURL(blob);
      const mod = await import(moduleUrl);
      const Source = mod.Source || mod.default;
      if (!Source) throw new Error('No Source export found');
      const instance = new Source({ client: createClientShim(), crypto: createCryptoShim(), baseUrl: msg.baseUrl });
      adapted = adaptSource(instance);
      self.postMessage({ type: 'loaded', id: msg.id });
      return;
    }
    if (msg.type === 'call') {
      if (!adapted) throw new Error('Not loaded');
      const method = msg.method;
      if (typeof adapted[method] !== 'function') throw new Error(`Unknown method: ${method}`);
      const result = await adapted[method](...(msg.args || []));
      self.postMessage({ type: 'result', result });
      return;
    }
    self.postMessage({ type: 'error', error: 'Unknown message type' });
  } catch (err) {
    self.postMessage({ type: 'error', error: err.message || String(err) });
  }
};
