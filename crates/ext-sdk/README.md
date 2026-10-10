# crates/ext-sdk

SDK Rust de alto nivel para escribir extensiones AniWeb (componentes WASM).
Sin dependencias: los helpers son puros sobre los tipos espejo del contrato
`aniweb:extension` y el `Host` (punteros a las host functions).

## Como se usa

La extension genera sus bindings con cargo-component (`src/bindings.rs`) y
construye el `Host` con el macro `host!`, que adapta los tipos generados a los
tipos espejo del SDK (una sola fuente de verdad para la conversion):

```rust
use aniweb_ext_sdk as sdk;
use bindings::exports::aniweb::extension::extension_api::*;

// En init() o en un static:
let h = sdk::host!(bindings);
let doc = sdk::http::get_json_doc(&h, "https://api.ejemplo.net/x").map_err(|_| Error::Message("red".into()))?;
let title = doc.get_str("data.title")?.unwrap_or_default();
let paginas = sdk::parsing::parse(&h, html_bruto).select(".page img");
```

## Modulos

- `types` — tipos espejo del WIT: `Header`, `Range`, `HttpResponse`, `HttpError`,
  `JsonValue`, `JsonError`, `LogLevel`.
- `host` — `Host` (fn pointers de todas las host functions) + macro `host!(bindings)`.
- `http` — `get`, `get_text`, `get_json_doc`, `get_json`, `get_with_headers` (rango opcional).
- `json` — `JsonDoc` con RAII (dropea el handle en el host): `get`, `get_str`,
  `get_all`, `get_all_str`, `length`, `get_bool`, `get_f64`.
- `json_value` — `Json`: parser JSON puro (sin deps) con traversal completo de
  objetos/arrays anidados (`get`, `index`, `path`, `first_str`). La interfaz
  `json` del host solo devuelve hojas por path porque el contrato WIT no admite
  tipos recursivos; para APIs con estructuras anidadas (mapas localizados,
  relaciones) usa `http::get_json` y este tipo. El parseo corre en el sandbox WASM.
- `parsing` — `HtmlDoc`/`Element` con RAII: `select`, `attribute`, `text`,
  `children`, `parent`, `html`.
- `crypto` — `base64_encode/decode`, `sha256_hex/bytes`, `md5_hex/bytes`, `hex`.
- `log` — `trace/debug/info/warn/error`, `log`.
- `storage` — clave/valor aislado por extension: `get`, `set`, `keys`, `get_bool`, `set_bool`.
- `url` — puros: `urlencode` (RFC 3986), `join`. Con tests.

## Notas

- El SDK NO genera bindings propios: las extensiones usan los que genera
  cargo-component, con la version de wit-bindgen del template (pin en CI:
  cargo-component 0.21.1 + wit-bindgen 0.41).
- Receta de toolchain para build local en Windows (rustup GNU + w64devkit,
  import libs faltantes): ver `docs/06-ext-sdk.md`.

Ver: `docs/00-roadmap.md` (Fase 6), `docs/04-wit-extensiones.md`.