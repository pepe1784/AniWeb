// Host `storage` (clave/valor aislado por extension) del runtime.
//
// El backend es inyectable y **sincrono** (la interface WIT lo es): en el
// navegador se respalda con un snapshot en memoria cargado desde IndexedDB al
// iniciar la extension y volcado al cerrarla (ADR-005). En tests se usa un
// backend en memoria. El aislamiento se consigue con un espacio de nombres por
// extension (su `id`).

export function createMemoryBackend() {
  const data = new Map(); // namespace -> Map<key, value>
  return {
    get(namespace, key) {
      return data.get(namespace)?.get(key);
    },
    set(namespace, key, value) {
      if (!data.has(namespace)) data.set(namespace, new Map());
      data.get(namespace).set(key, value);
    },
    delete(namespace, key) {
      data.get(namespace)?.delete(key);
    },
    keys(namespace) {
      return [...(data.get(namespace)?.keys() ?? [])];
    },
  };
}

// Crea el host `storage` para una extension concreta.
export function createStorageHost(backend, namespace) {
  const ns = String(namespace);
  return {
    get(key) {
      const value = backend.get(ns, String(key));
      return value === undefined || value === null ? undefined : String(value);
    },
    set(key, value) {
      backend.set(ns, String(key), String(value));
    },
    keys() {
      return backend.keys(ns).slice().sort();
    },
  };
}
