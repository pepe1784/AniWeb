// Puente WIT `storage`. El espacio de nombres es el `id` de la extension.

import { createMemoryBackend, createStorageHost } from "../storage-host.mjs";

const backend = globalThis.__ANIWEB_STORAGE_BACKEND__ ?? createMemoryBackend();
const host = createStorageHost(backend, (globalThis.__ANIWEB_HOST_CONFIG__ ?? {}).id ?? "extension");

export const get = (key) => host.get(key);
export const set = (key, value) => host.set(key, value);
export const keys = () => host.keys();
