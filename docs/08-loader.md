# 08 · Loader de extensiones y runtime del navegador

> Fase 8 del roadmap. Descarga y verificación de extensiones (WASM Component
> Model) desde repos de extensiones, permisos por manifest, instanciación en
> Workers aislados con los host functions implementados en `packages/ext-host`,
> límites de memoria/tiempo y CSP estricta. Entregable 8: `packages/ext-loader/`
> + `packages/ext-host/src/wit-imports/` + esta especificación.

**Criterio de aceptación cumplido:** la extensión de ejemplo de la Fase 6
(MangaOni) se carga en un Worker y `searchManga("naruto", 1)` devuelve
resultados correctos (red por XHR síncrono -> proxy CORS -> manga-oni.com,
parseo HTML con el host `parsing`). Ver "Validación end-to-end" abajo.

---

## Piezas del entregable

| Pieza | Ruta |
| --- | --- |
| Verificación de integridad (SHA-256 WebCrypto + tamaño) | `packages/ext-loader/src/verify.mjs` |
| Catálogo `index.json` v1 (validación, última versión, URLs) | `packages/ext-loader/src/catalog.mjs` |
| Límites (tiempo/memoria/respuestas) + RPC con timeout | `packages/ext-loader/src/limits.mjs` |
| API del hilo principal (instalar, permisos, sandbox, actualizar) | `packages/ext-loader/src/loader.mjs` |
| Despacho de llamadas del lado Worker (protocolo del sandbox) | `packages/ext-loader/src/dispatch.mjs` |
| Entry del Worker de extensiones | `packages/ext-loader/src/run-extension-worker.mjs` |
| Política CSP estricta | `packages/ext-loader/src/csp.mjs` |
| Puente de imports WIT (host functions jco) | `packages/ext-host/src/wit-imports/` |
| Arnés E2E en navegador | `packages/ext-loader/browser-e2e/serve.mjs` |
| Esta especificación | `docs/08-loader.md` |

---

## Instanciación de un componente en el navegador

Una extensión es un componente WASM compilado con `cargo-component`
(`wasm32-wasip1`). El navegador no instancia componentes directamente; se
transpilan con `jco` a JS + core wasm:

```
jco transpile manga-oni.wasm -o out --name manga-oni
# out/manga-oni.js, out/manga-oni.core.wasm, out/manga-oni.core2.wasm
```

El JS resultante **se auto-instancia** en el top-level await del import y
expone `extensionApi` (funciones `init`, `id`, `searchManga`...). Importa:

- las host functions como módulos bare: `aniweb:extension/{http,json,crypto,storage,parsing,logging}`;
- los shims WASI preview2: `@bytecodealliance/preview2-shim/{cli,filesystem,io}`.

### El detalle que hay que conocer (rescate de camino del E2E)

jco usa el **mismo string WIT** como especificador del `import` ES y como
**clave del objeto de imports** de los core modules. Si se reescriben todos los
specifiers (p. ej. `'aniweb:extension/json'` -> una ruta), los imports de los
core modules dejan de encontrar su clave y la instanciación falla con
`WebAssembly.instantiate(): Import #0 "aniweb:extension/json": module is not an
object or function`.

La regla: **solo se reescriben los `import ... from '...'`**, nunca las claves
internas. Es lo que hace `browser-e2e/serve.mjs` y lo que debe hacer el paso de
empaquetado. Detalle reproducible en `packages/ext-loader/README.md`.

### Por qué el WASM y no ejecutar JS del repo

El componente WASM cumple un WIT fijo (`packages/ext-api/wit/extension.wit`):
sin `eval`, sin DOM, sin red directa. El host nunca ejecuta código descargado
fuera del Worker. La CSP del sitio (ver abajo) cierra `eval` y `unsafe-inline`.

---

## Host functions y puente de imports

Los puentes `packages/ext-host/src/wit-imports/*.mjs` exponen una función por
nombre WIT (`request`, `parse`, `get`...) que delega en el host correspondiente
(`createHttpHost`, `createJsonHost`, `createParsingHost`, `createCryptoHost`,
`createStorageHost`, `createLoggingHost`). La configuración se lee de
`globalThis.__ANIWEB_HOST_CONFIG__`, que el Worker fija ANTES del import
dinámico del componente:

```js
globalThis.__ANIWEB_HOST_CONFIG__ = {
  id: "manga-oni",
  sites: ["manga-oni.com", "oni.ntr-files.online"],   // permisos de red
  proxyUrl: "https://proxy.aniweb.example.net/",       // proxy CORS (Fase 7)
  timeoutMs: 30000,                                    // por http.request
  maxBytes: 33554432,                                  // cuerpo máximo
};
const { extensionApi } = await import(entryUrl);        // jco se auto-instancia
```

Los shims WASI preview2 (`@bytecodealliance/preview2-shim/dist/browser/*`) se
sirven junto a la app; Rust los usa para `std` (environment, exit, streams).
Si el componente nunca los invoca, no se tocan.

---

## Formato de publicación del artefacto

La tienda de un repo de extensiones (formato completo en `docs/04-wit-extensiones.md`)
declara `wasm.url/sha256/size`. AniWeb admite además un **bundle transpilado**
para poder correr en el navegador sin Node:

```json
"bundle": {
  "entry": "manga-oni.js",
  "files": [
    { "name": "manga-oni.js", "sha256": "9f2c...", "size": 497152 },
    { "name": "manga-oni.core.wasm", "sha256": "0ab1...", "size": 102400 },
    { "name": "manga-oni.core2.wasm", "sha256": "c3d4...", "size": 8192 }
  ]
}
```

- `entry` es el módulo que arranca (`import` dinámico del Worker).
- Cada archivo se verifica por `sha256` + `size` contra `bundle.files`.
- Los `import ... from 'aniweb:extension/*'` y `@bytecodealliance/preview2-shim/*`
  llegan **ya reescritos** a las rutas servibles de la app (`/host/wit-imports/...`,
  `/shim/...`), tal como hace `browser-e2e/serve.mjs`.
- Una entrada sin `bundle` (solo `wasm`) sigue siendo válida: se verifica igual
  y queda **pendiente de transpilar** (requiere Node/jco; no corre en el
  navegador sin el paso previo).

El CI del repo de extensiones produce el bundle en la publicación; el detalle
de `scripts/build-index.mjs` de los repos de ejemplo refleja este paso.

## Ciclo de vida

1. **Descubrimiento**: `fetchCatalog(repoUrl)` valida el `index.json` v1.
2. **Selección**: `getLatestExtension(catalog, id)` elige la última versión.
3. **Instalación**: `installArtifacts(entry, {catalogUrl})` descarga cada
   archivo y verifica `sha256`/`size` (WebCrypto). Los bytes se guardan en
   CacheStorage/OPFS bajo `/pkg/<id>/...` (responsabilidad de la app, Fase 9);
   `computeArtifactPaths` da las rutas.
4. **Sandbox**: `createSandbox({entryUrl, hostConfig, workerUrl, limits})`
   crea un Worker de módulo aislado; `start()` instancia el componente,
   ejecuta `init(settings)` y comprueba que `id()` coincida con el manifest.
5. **Uso**: `sandbox.call("searchManga", ["naruto", 1])`.
6. **Actualización**: `checkUpdate(instalado, catalogo)` compara versiones.

## Permisos

- Los `sites` del manifest/catálogo son la única fuente de permisos de red.
- `buildHostConfig` los copia al host de red; el host lanza `blocked` si la
  URL no coincide con el dominio permitido (host + subdominios).
- El proxy CORS (Fase 7) revalida el allowlist por cada hop de redirect.
- El loader no puede ampliar `sites`: es una lista cerrada.

## Límites (tiempo y memoria) — lo que se puede y no se puede

| Límite | Default | Dónde |
| --- | --- | --- |
| `callTimeoutMs` | 30 s | `limits.mjs`; el hilo principal termina el Worker si la llamada no responde (`code: 'timeout'`) |
| `httpMaxBytes` | 32 MiB | host `http`: cuerpo máximo, error `too-large` del WIT |
| `storageMaxValueBytes` | 256 KiB | backend de storage (el WIT no da canal de error) |
| `maxResponses` | 100 | `dispatch.mjs`: recorta listas y marca `truncated` |

Compromisos honestos:

1. **Las funciones exportadas son síncronas** (ABI del WIT): no se pueden
   interrumpir con un timer dentro de su propio hilo. El límite de tiempo se
   impone desde el hilo principal terminando el Worker; ningún Worker queda
   colgado, y las llamadas siguientes fallan hasta recrear el sandbox.
2. **El heap WASM no se puede topar duro desde JS**: el componente pide su
   propio `WebAssembly.Memory` en su start. Mitigaciones: presupuesto por
   secuencia de red (cada `http.request` pagado por `httpMaxBytes`),
   `maxResponses`, y detección de bloqueo por timeout con Worker nuevo.
3. **`storage` no tiene canal de error** en el WIT; su tope lo aplica el
   backend (in-memory hoy, persistentes en ADR-005).

## CSP estricta

La política (`src/csp.mjs`) incluye:

```
default-src 'self'; script-src 'self' 'wasm-unsafe-eval';
worker-src 'self' blob:; connect-src 'self';
img-src 'self' data: blob: https:; style-src 'self';
font-src 'self' data:; frame-src 'none'; object-src 'none';
base-uri 'none'; form-action 'none'
```

- `'wasm-unsafe-eval'` es imprescindible para `WebAssembly.instantiate`/
  `compileStreaming` de jco; **no** se usa `'unsafe-eval'` (el código generado
  no evalúa).
- `connect-src` debe incluir el origen del proxy CORS configurado y, si se
  quieren repos remotos, `https:`.
- Los Workers heredan la CSP del documento que los crea; cubre a los Workers
  de extensiones.

## Protocolo del sandbox (Worker de módulo)

```
main -> Worker   { type: "instantiate", entryUrl, settings, hostConfig, limits }
Worker -> main   { type: "ready", id } | { type: "error", reason }
main -> Worker   { type: "call", name, args }
Worker -> main   { type: "result", ok, truncated } | { type: "result", err }
```

- `init(settings)` e `id()` se resuelven en la instanciación; el `id` debe
  coincidir con el manifest, si no el Worker se cierra con error.
- `dispatch.mjs` traduce errores del WIT (`message`, `not-supported`,
  `no-results`, `timeout`) y errores JS a `{ tag, val }`.

## Validación end-to-end (Chromium)

`browser-e2e/serve.mjs` transpila con jco, sirve componente + puentes + shims,
levanta el proxy CORS y un Worker instancia el componente. Resultado verificado
con MangaOni (oct 2026):

```json
{ "id": "manga-oni",
  "searchCount": 9,
  "search": [
    { "id": "naruto-gaiden", "title": "Naruto Gaiden",
      "url": "https://manga-oni.com/manga/naruto-gaiden/", ... },
    { "id": "boruto", "title": "Boruto", ... },
    { "id": "naruto", "title": "Naruto", ... }
  ] }
```

Flujo completo ejercitado: Worker módulo -> jco (componente WASM) -> host
`http` (XHR síncrono) -> proxy local 8787 -> manga-oni.com -> parser CSS ->
resultados `catalog-result`.

Comandos:

```sh
cd packages/ext-api && npm install          # jco (ya instalado por defecto)
$env:ANIWEB_E2E_WASM="...\ext-repos\manga-oni\dist\manga-oni.wasm"
node packages/ext-loader/browser-e2e/serve.mjs   # abre http://127.0.0.1:8099/test.html
```

Pruebas de unidad (todo el entregable, sin navegador):

```sh
cd packages/ext-loader && node --test   # 39/39
cd packages/ext-host && node --test     # 38/38
```

## Riesgos y pendientes

- **Almacenamiento del bundle**: los bytes verificados deben servirse desde
  rutas reales del origen (`/pkg/<id>/...`) para que los imports relativos
  (`./manga-oni.core.wasm`) resuelvan; los blob URLs no sirven para paquetes
  multifichero. CacheStorage + Service Worker lo resuelve en la Fase 9.
- **minisign**: el campo del catálogo ya existe; el verificador queda pendiente.
- **WIT async**: si en el futuro el WIT admite `async`, el transporte de red se
  sustituye (`createSyncXhrTransport` -> fetch) y el runtime no cambia.
- **Límite de heap WASM**: imposible de topar duro desde JS (ver arriba);
  monitorear con `memory growth` del núcleo como mejora futura.

Ver: `docs/04-wit-extensiones.md`, `docs/07-proxy-cors.md`,
`packages/ext-host/README.md`, `docs/00-roadmap.md` (Fase 8).