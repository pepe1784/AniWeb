// Sandbox to run JS extensions in a Worker
export function createSandbox({ workerUrl, worker }) {
  const w = worker ?? new Worker(workerUrl, { type: 'module' });
  let loaded = false;
  
  return {
    async load(code, id, baseUrl) {
      return new Promise((resolve, reject) => {
        const handler = (e) => {
          const msg = e.data;
          if (msg?.type === 'loaded' && (!id || msg.id === id)) {
            w.removeEventListener('message', handler);
            loaded = true;
            resolve();
          } else if (msg?.type === 'error') {
            w.removeEventListener('message', handler);
            reject(new Error(msg.error));
          }
        };
        w.addEventListener('message', handler);
        w.postMessage({ type: 'load', code, id, baseUrl });
      });
    },
    async call(method, args = []) {
      if (!loaded) throw new Error('Sandbox not loaded');
      return new Promise((resolve, reject) => {
        const handler = (e) => {
          const msg = e.data;
          if (msg?.type === 'result') {
            w.removeEventListener('message', handler);
            resolve(msg.result);
          } else if (msg?.type === 'error') {
            w.removeEventListener('message', handler);
            reject(new Error(msg.error));
          }
        };
        w.addEventListener('message', handler);
        w.postMessage({ type: 'call', method, args });
      });
    },
    terminate() {
      w.terminate();
    },
    get loaded() {
      return loaded;
    },
  };
}
