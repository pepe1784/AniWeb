// JS runtime fallback using runtimes/js package
import { createSandbox } from '@aniweb/runtimes-js/src/sandbox.mjs';

export async function loadJsExtension(code: string, id: string, baseUrl: string = 'https://example.com') {
  const workerUrl = new URL('@aniweb/runtimes-js/src/worker.mjs', import.meta.url);
  const sandbox = createSandbox({ workerUrl });
  await sandbox.load(code, id, baseUrl);
  return sandbox;
}
