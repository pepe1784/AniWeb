// Fallback WASM extensions loader for WebUI (integrates existing WASM runtime)
import { createSandbox } from '@aniweb/ext-loader/src/loader.mjs';
import { buildHostConfig } from '@aniweb/ext-loader/src/loader.mjs';
import { fetchCatalog } from '@aniweb/ext-loader/src/catalog.mjs';

export async function loadWasmExtension(id: string, entryUrl: string) {
  const hostConfig = buildHostConfig({ id, sites: ['*'] });
  const workerUrl = new URL('@aniweb/ext-loader/src/run-extension-worker.mjs', import.meta.url);
  const sandbox = createSandbox({ entryUrl, workerUrl, hostConfig });
  await sandbox.start('{}');
  return sandbox;
}
