# 04 · Interfaz WIT de extensiones

> Fase 4 del roadmap. Contrato entre las extensiones (WASM con Component Model) y el host de la PWA: tipos de datos, host functions de identidad, API que cada extension exporta, empaquetado de repos de extensiones (catalogo `index.json`), ciclo de vida y limites. Entregable 4: `packages/ext-api/` + esta especificacion.

## Objetivo

Definir un contrato nuevo, estable y verificable para que extensiones escritas en Rust (u otro idioma que emita componentes WASM) aporten catalogo de manga/anime a AniWeb sin ejecutar JavaScript ni Python descargado, y sin acceso directo a la red ni al DOM.

## Piezas del entregable

| Pieza | Ruta |
| --- | --- |
| Contrato WIT (world `extension`) | `packages/ext-api/wit/extension.wit` |
| Bindings TS generados con `jco types` | `packages/ext-api/src/generated/` |
| Regeneracion de bindings (script) | `packages/ext-api/package.json` (`npm run types`) |
| Guia del paquete | `packages/ext-api/README.md` |
| Esta especificacion | `docs/04-wit-extensiones.md` |

La fuente de verdad del contrato es el WIT. Los bindings TS se regeneran con `npm run types` y se commitean para que los consumidores del host no necesiten instalar jco.

---

## Arquitectura del contrato

```
+--------------------------------------------+
| PWA (host)                                  |
|  ext-loader: Worker aislado por extension   |
|  ext-host: implementa las imports           |
+---------------------+----------------------+
                      | Componente WASM (Component Model)
                      v
   world extension {
     import http      (red: solo dominios del manifest, via proxy CORS)
     import parsing   (HTML con selectores CSS, el host conserva el arbol)
     import json      (JSON por paths, el host conserva el arbol)
     import crypto    (base64, sha256, md5)
     import logging   (registro de eventos visible en la UI)
     import storage   (clave/valor aislado por extension)
     export extension-api (API que la extension implementa)
   }
```

Direccion de la dependencia: la extension **importa** identidad (host functions) y **exporta** su API. El host nunca ejecuta codigo arbitrario de la extension fuera del Worker; la extension nunca toca la red, el DOM ni el almacenamiento del sitio directamente.

---

## Tipos de datos compartidos (interface `types`)

| Tipo | Uso |
| --- | --- |
| `error` | Variante de error comun: `message(string)`, `not-supported`, `no-results`, `timeout` |
| `header` | Par `name`/`value` para peticiones HTTP |
| `nsfw-level` | `safe`, `suggestive`, `nsfw` |
| `catalog-result` | Fila de catalogo/busqueda: `id`, `title`, `url`, `thumbnail-url`, `author?`, `status?` |
| `chapter` | Capitulo: `id`, `name`, `url`, `scanlator?`, `uploaded-at?`, `page-count?` |
| `manga-page` | Pagina: `url`, `index`, `headers` |
| `manga-detail` | Detalle: datos del titulo + `chapters` |
| `episode` | Episodio: `id`, `name`, `url`, `uploaded-at?` |
| `quality` | Fuente de video con calidad/formato: `url`, `quality?`, `format?`, `headers` |
| `subtitle` | Subtitulo: `url`, `lang?`, `format?` |
| `video-source` | Servidor/source con `qualities` y `subtitles` |

Todos los campos son UTF-8. Las fechas (`uploaded-at`, `updated-at`) son ISO-8601 opcionales.

---

## Host functions (identidad que el host debe implementar)

### `http` — red validada

La unica via de red de la extension.

```wit
request: func(
  url: string,
  method: option<string>,
  headers: list<header>,
  body: option<list<u8>>,
  range: option<range>,   // { start: u64, end: option<u64> } para rangos
) -> result<http-response, http-error>;
```

- El host valida `url` contra los dominios autorizados del manifest de la extension y la enruta por el proxy CORS configurado (por defecto el publico; la persona puede apuntar al suyo).
- `http-error`: `blocked` (dominio no autorizado), `timeout`, `too-large`, `invalid-url`, `network(string)`.
- Respuesta maxima y timeout por llamada: parametros del host, documentados en las fases 7-8 (proxy y loader).

### `parsing` — HTML con selectores CSS

```wit
parse(html: string) -> u32;               // handle de documento
select(doc: u32, selector: string) -> list<u32>;
element-attr(e: u32, attribute: string) -> option<string>;
element-text(e: u32) -> option<string>;
element-html(e: u32) -> option<string>;
element-parent(e: u32) -> option<u32>;
element-children(e: u32) -> list<u32>;
drop(doc: u32);
```

- El host conserva el arbol; la extension solo ve handles `u32` y resultados por selector.
- Motivo del diseno: WIT no permite tipos recursivos, asi que el DOM no se modela como arbol en la interface.
- El selector engine del host es un subconjunto de CSS (sin ejecucion de JS de la pagina, sin pseudo-clases de estado dinamico). Los selectores que no soporte devuelven resultado vacio; se documentara el subconjunto exacto en la fase 6 con el SDK.

### `json` — JSON por paths

```wit
parse(text: string) -> result<u32, json-error>;
get(doc: u32, path: string) -> result<json-value, json-error>;
get-all(doc: u32, path: string) -> result<list<json-value>, json-error>;
length(doc: u32, path: string) -> result<u32, json-error>;
drop(doc: u32);
```

- `json-value` es una variante de **hoja**: `null`, `boolean(bool)`, `number(f64)`, `str(string)`. (El caso string se llama `str` porque `string` es palabra clave de WIT.)
- Paths estilo `data.results[0].title` y comodin `data.results[*].id`. Apuntar a un objeto o array con `get` devuelve `invalid-path`; se usa `length` para listas.
- Mismo motivo que `parsing`: el arbol JSON queda en el host (handles + paths), eludiendo la no-recursion de WIT.

### `crypto` — utilidades

`base64-encode(bytes) -> string`, `base64-decode(text) -> result<list<u8>, string>`, `sha256(bytes) -> list<u8>`, `md5(bytes) -> list<u8>`. Implementadas con WebCrypto en el host (md5 solo cuando el sitio remoto la exija, p. ej. firmas de API).

### `logging` — eventos

`log(level: log-level, message: string)` con niveles `trace`, `debug`, `info`, `warn`, `error`. Los mensajes se muestran en la consola de la extension de la app; nunca en la consola del sitio.

### `storage` — clave/valor aislado

`get(key) -> option<string>`, `set(key, value)`, `keys() -> list<string>`. Persistencia por extension e instancia, aislada respecto a otras extensiones (ver ADR-005 en fase 8).

---

## API de la extension (interface `extension-api`, exportada)

La extension debe implementar:

| Funcion | Caso del criterio de aceptacion |
| --- | --- |
| `init(settings: string) -> result<_, error>` | Arranque con la configuracion del usuario (JSON en string) |
| `id() -> string` | Debe coincidir con el `id` del manifest instalado |
| `get-manga-popular(page)` / `get-manga-recent(page)` / `search-manga(query, page)` | Catalogo y busqueda manga |
| `get-manga-detail(url)` | Detalle de manga |
| `get-chapters(manga-url)` | Capitulos |
| `get-manga-pages(chapter-url)` | Paginas (con `headers` por pagina) |
| `get-anime-popular(page)` / `get-anime-recent(page)` / `search-anime(query, page)` | Catalogo y busqueda anime |
| `get-episodes(anime-url)` | Episodios |
| `get-video-sources(episode-url)` | Servidores/fuentes de video con subtitulos |

Una extension no tiene por que implementar todas: las que no apliquen devuelven `not-supported` (p. ej. una extension solo-manga devuelve `not-supported` en las llamadas anime). El manifest declara `kind` (`manga`, `anime` o `both`) para que el host oculto lo que no aplique.

---

## Recorrido de una llamada (ejemplo: buscar manga)

1. La persona escribe la query en la app.
2. El host instancia la extension en un Worker aislado (o reusa la instancia viva con su `storage`).
3. El host llama `search-manga(query, page)`.
4. La extension construye la peticion y llama `http.request(...)` con el URL del sitio.
5. El host valida el dominio contra el manifest; si no esta autorizado devuelve `blocked` sin tocar la red.
6. Si esta autorizado, la peticion sale por el proxy CORS configurado.
7. La extension parsea la respuesta (`parsing.select` o `json.get/get-all`) y devuelve `list<catalog-result>`.

---

## Ciclo de vida de una extension

1. **Descubrimiento**: la app obtiene el catalogo `index.json` de un repo de extensiones (URL del usuario, cron) — ver seccion siguiente.
2. **Verificacion**: descarga el `.wasm` y comprueba su SHA-256 contra el catalogo (WebCrypto). Minisign opcional, cuando el repo lo firme, para proteger el catalogo en transito.
3. **Instanciacion**: el `.wasm` (componente) se instancia en un Worker aislado con limites de memoria y tiempo por llamada (fase 8).
4. **Arranque**: `init(settings)` con la configuracion de la persona; `id()` debe coincidir con el manifest instalado.
5. **Uso**: llamadas de catalogo/detalle/fuentes.
6. **Actualizacion**: el host compara `version`/`updated-at` del catalogo con lo instalado y avisa o actualiza bajo consentimiento.

---

## Repos de extensiones y catalogo `index.json`

Un repo de extensiones es cualquier sitio estatico (GitHub Pages, releases de GitHub, hosting cualquiera) que sirva:

1. `index.json` — catalogo de extensiones publicadas.
2. Los `.wasm` referenciados con su hash.

### Ejemplo de `index.json`

```json
{
  "format-version": 1,
  "wit-version": "aniweb:extension@0.1",
  "generated-at": "2026-10-09T10:00:00Z",
  "extensions": [
    {
      "id": "mangadex-es",
      "name": "MangaDex (ES)",
      "lang": "es",
      "nsfw": "safe",
      "kind": "manga",
      "version": "1.0.0",
      "min-api-version": "0.1",
      "sites": ["api.mangadex.org", "uploads.mangadex.org"],
      "default-proxy": "https://proxy.aniweb.example.net",
      "wasm": {
        "url": "https://github.com/pepe1784/aniweb-extensions/releases/download/mangadex-es-1.0.0/mangadex-es.wasm",
        "sha256": "9f2c4e8b1a3d5c7e6a0b2f4d8c1e3a5b7d9f0c2e4a6b8d0f1e3c5a7b9d0f2e4c6a",
        "size": 1048576
      },
      "minisign": "RWT8dGFvYWZ3b3JrZXIuY29tLmFuaXdlYi4uLg==",
      "updated-at": "2026-10-09T10:00:00Z"
    }
  ]
}
```

Campos de una entrada:

| Campo | Necesario | Descripcion |
| --- | --- | --- |
| `id` | si | Identificador unico; debe coincidir con `id()` de la extension |
| `name`, `lang`, `nsfw` | si | Presentacion en el repositorio de la app |
| `kind` | si | `manga`, `anime` o `both` |
| `version` | si | Version semver de la extension |
| `min-api-version` | si | Version del WIT con la que se compilo |
| `sites` | si | Dominios autorizados para `http.request` |
| `default-proxy` | no | Proxy sugerido por la extension (el usuario puede cambiarlo) |
| `wasm.url`, `wasm.sha256`, `wasm.size` | si | Artefacto verificable |
| `minisign` | no | Firma opcional del `.wasm` (ver nota) |
| `updated-at` | si | Para la politica de actualizaciones |

Nota sobre `minisign`: la firma protege el `.wasm` contra sustitucion; el SHA-256 ya cubre integridad, la firma cubre autenticidad del publicador. El soporte publicitario del verificador se entrega en la fase 8; en esta fase queda especificado el campo y su formato (basado en minisign).

### Workflow de publicacion de una extension

1. Se compila el componente WASM (fase 5-6: plantilla `extension-template/` con CI).
2. El CI calcula SHA-256 y `size`, firma opcionalmente con minisign.
3. Se sube `.wasm` a un release o sitio estatico.
4. Se actualiza `index.json` con la nueva entrada.
5. La app refresca el catalogo cron (o manual) y ofrece la actualizacion.

---

## Limites y compromisos (importantes)

1. **`<img>` no puede enviar headers personalizados.** El lector muestra paginas de manga y portadas con `<img>`. Si el sitio remoto exige `Referer` u otro header (hotlink protection), un `<img>` comun no lo puede mandar. Solucion documentada: esos fetch van `http.request` -> proxy (que si manda headers) -> blob -> `URL.createObjectURL`. Conlleva descarga por la memoria de la pestaña; las paginas offline se guardan en OPFS (ADR-005). Esto ya se anticipo en `docs/01-viabilidad-navegador-pwa.md`.
2. **El proxy ve el trafico de las extensiones.** Por defecto se usa el proxy comun del proyecto; cada persona deberia desplegar el suyo (fases 3 y 7). Alternativa futura para fuentes publicas con CORS abierto: peticion directa sin proxy.
3. **JSON/HTML no recursivos.** Los arboles viven en el host; la interface usa handles + paths/selectores. Esto impide que la extension recorra libremente el arbol JSON, pero mantiene el contrato WIT valido y pequeno.
4. **Tamanos y tiempos**: el host aplica respuesta maxima por `http.request` y timeout por llamada; valores concretos en fase 8 (loader).
5. **No hay evaluacion de codigo remoto**: solo componentes WASM que cumplen el WIT. `eval` prohibido y CSP estricta del sitio no lo permite (ADR-002, fase 8).
6. **MD5 solo para compatibilidad** con sitios que la exigen (firmas de API); no se usa para integridad.

---

## Validacion del entregable

1. `npx jco types` sobre `wit/extension.wit` regenera los bindings sin errores (jco 1.37.0 usado para la generacion).
2. `npm run types` (en `packages/ext-api/`) reproduce los mismos archivos y `npm run check` queda limpio.
3. La especificacion cubre los casos del criterio de aceptacion: metadatos, busqueda, populares, recientes, detalle, capitulos/episodios, paginas, fuentes de video.

Comandos:

```sh
cd packages/ext-api
npm install
npm run types   # regenera src/generated desde wit/extension.wit
npm run check   # verifica que no haya diffs (para CI)
```

## Pendiente para fases siguientes

- **Fase 5**: plantilla de repo de extensiones con CI que publique `index.json` + hash (consumidor de esta especificacion).
- **Fase 6**: `crates/ext-sdk` con bindings Rust generados por wit-bindgen (requiere toolchain Rust/cargo, no disponible en esta maquina) y extensiones de ejemplo.
- **Fase 7**: proxy CORS que cumpla lo que `http.request` espera (Range, headers personalizados, dominios permitidos).
- **Fase 8**: loader (descarga, SHA-256, instanciacion en Worker, permisos, limites de memoria/tiempo) y host functions en el navegador.