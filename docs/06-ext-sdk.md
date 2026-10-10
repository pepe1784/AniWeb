# 06 · SDK de extensiones y extensiones de ejemplo

> Fase 6 del roadmap. Documenta el SDK Rust (`crates/ext-sdk`), la receta de toolchain en Windows, los formatos del catálogo del ecosistema y las dos extensiones de ejemplo (externas al monorepo): **MangaOni** (manga) y **AnimeAV1** (anime).

## Objetivo

Que cualquiera pueda escribir una extensión AniWeb en Rust, compilarla a un componente WebAssembly contra el WIT `aniweb:extension` y publicarla como un repo de extensiones consumible por la app, sin tocar el monorepo.

## Modelo

- Las extensiones **no viven en el monorepo**: son repos externos (estilo Aniyomi/Mihon/Keiyoushi). El monorepo aporta el contrato (`packages/ext-api/wit/extension.wit`), el SDK (`crates/ext-sdk`) y la plantilla (`extension-template/`).
- Un repo de extensiones aloja **varias extensiones** (`extensions/<id>/`), cada una con su versión en `extension-metadata.json`.
- El artefacto es un **componente WASM** (no un APK). El host (Fase 8) lo ejecuta en un Worker aislado: sin DOM, sin red directa; todo pasa por `http.request` validado contra los dominios del manifiesto.

## Por qué `.apk` no se traduce a `.wasm`

Un APK de Aniyomi/Tachiyomi es código **Dalvik/ART para Android** con acceso al framework de Android, a `OkHttp`, a Jsoup nativo y a extractores que usan `javax.crypto`. No existe una traducción automática fiable de eso a un componente WASM sandbox. La vía real y honesta es **portar el código fuente** de fuentes abiertas:

- Fuentes de Aniyomi: `Kohi-den/extensions-source` y `yuzono/anime-extensions` (licencia Apache-2.0).
- Fuentes de Tachiyomi/Mihon: `keiyoushi/extensions-source` (Apache-2.0).

Se reescribe la lógica en Rust sobre `crates/ext-sdk`. Lo que depende de extractores Android (JS ofuscado, AES con claves fijas, WebView) **no** se porta; se documenta como no soportado.

## El SDK (`crates/ext-sdk`)

Sin dependencias. La extensión genera sus bindings con `cargo-component` (`src/bindings.rs`) y construye el `Host` con el macro `host!`:

```rust
use aniweb_ext_sdk as sdk;
use bindings::exports::aniweb::extension::extension_api::*;

fn host() -> sdk::Host { sdk::host!(crate::bindings) }

// catalogo HTML
let html = sdk::http::get_text(&host(), "https://sitio/listado").map_err(|e| Error::Message(e.to_string()))?;
let doc = sdk::parsing::HtmlDoc::parse(&host(), &html);
for card in doc.select("article.item") {
    let title = card.select("h3").into_iter().next().and_then(|e| e.text()).unwrap_or_default();
}

// JSON anidado (la interfaz `json` del host solo da hojas por path)
let data = sdk::http::get_json(&host(), "https://api/x")?;      // sdk::Json
let id = data.str_at("data[0].attributes.title").unwrap_or("");

// texto/base64 sin regex
let b64 = sdk::text::between(&html, "var unicap = '", "'").unwrap_or("");
let pages = sdk::crypto::base64_decode(&host(), b64)?;
```

Módulos: `types`, `host` (+ macro `host!`), `http`, `json` (`JsonDoc`), `json_value` (`Json`, parser puro con traversal), `parsing` (`HtmlDoc`/`Element`), `text` (puros, con tests: `between`, `bracket_after`, `objects`, `value_after`, `slug`), `crypto`, `log`, `storage`, `url`.

Dos decisiones del SDK justificadas por el contrato WIT (que no admite tipos recursivos ni regex):

1. `json_value` — la interfaz `json` del host devuelve hojas por path; para árboles anidados la extensión parsea el body con `sdk::Json` (corre en el sandbox WASM).
2. `text` — el host no trae motor de regex; las fuentes que publican datos en `<script>` inline se parsean con estos helpers deterministas (probados con fragmentos reales de AnimeAV1).

## Receta de toolchain en Windows

Probada en este equipo (rustc 1.99, target `wasm32-wasip1`, toolchain GNU):

```powershell
# 1) target + cargo-component fijado
rustup target add wasm32-wasip1
cargo install cargo-component --version 0.21.1 --locked

# 2) compilar (target/ FUERA del repo)
$env:Path="C:\Users\<usuario>\.cargo\bin;$env:Path"
$env:CARGO_TARGET_DIR="$env:TEMP\cc-build"
cargo component build --release --manifest-path extensions\<id>\Cargo.toml

# 3) el componente resultante
#    $env:TEMP\cc-build\wasm32-wasip1\release\aniweb_ext_<id>.wasm
```

Notas:
- `cargo-component 0.21.1` empaqueta `wit-bindgen 0.41`; por eso el `Cargo.toml` usa `wit-bindgen-rt = "0.41.0"`. Al subir de versión, actualiza ambos y prueba en CI.
- PowerShell no encadena con `&&` (usa `;`). `cargo`/`git` escriben en stderr y PowerShell puede reportar código 1 aunque terminen bien: verifica por el `.wasm` creado.
- `CARGO_TARGET_DIR` apunta fuera del repo (el monorepo no versiona `target/`).

## Formatos del catálogo del ecosistema

`scripts/build-index.mjs` emite cuatro salidas (verificadas contra `keiyoushi/extensions`):

| Archivo | Formato | Consumidor |
| --- | --- | --- |
| `index.json` | catálogo nativo AniWeb (`format-version: 1`) | la app AniWeb |
| `index.min.json` | array legacy del ecosistema | herramientas estilo Mihon/Tachiyomi |
| `index.pb` | protobuf v2 (`NetworkExtensionStore`, esquemas de Mihon) | herramientas estilo Mihon |
| `repo.json` | redirect legacy: `{"index_v2": "<url de index.pb>", "meta": {...}}` | flujo legacy |

- `versionCode = major*100000 + minor*1000 + patch` (`0.1.0` -> `1000`).
- `contentWarning`: nativo `safe`/`suggestive`/`nsfw`; legacy `0`/`1`/`2`; v2 `1`(SAFE)/`2`(MIXED)/`3`(NSFW).
- El `id` de cada source es un entero de 64 bits derivado de `aniweb:extension:<id>` (FNV-1a) o el valor de `source-id`.
- El binario referenciado es un `.wasm` (no un `.apk`): el ecosistema solo comparte la *forma* del catálogo.

## Extensiones de ejemplo (repos externos)

Ambas viven fuera del monorepo, en `C:\Users\<usuario>\Desktop\ext-repos\`, con git propio y estructura multi-extensión lista para añadir más fuentes. Referencian el SDK por ruta relativa para desarrollo local; en un repo real se cambia a dependencia git/crates.io (ver el README de cada repo).

### MangaOni (`manga-oni`) — manga, es

- Sitio: `https://manga-oni.com`; CDN de portadas `oni.ntr-files.online`.
- Modelada a partir del cliente libre `rubnmv7/MangaChoped` (`mangaoni-api.ts`) y del HTML real.
- Endpoints: popular `/directorio/?filtro=visitas&p=N`, reciente `/directorio/?filtro=id&p=N`, búsqueda `/buscar/?q=<query>` (HTML del servidor; sin CSRF).
- Selectores estables: `#article-div a[itemprop="url"]`, `a.portada img`, `#categ a`, `#info-i`, `#desarrollo`, `#sinopsis`, `#c_list a`.
- Páginas: `var unicap = '<base64>'` -> `<baseUrl>||["001.webp", ...]||`; cada página es `baseUrl + archivo`.
- WASM: 189766 bytes, sha256 `7ce922ddfa6d7ba9ff98f71cc50cfafa93e8b18a24c18fef3e4e4cf1f676a3e6`; source id `3473341724396140357`.

### AnimeAV1 (`animeav1`) — anime, es

- Sitio: `https://animeav1.com`; portadas `cdn.animeav1.com`.
- Portada de la fuente libre de Aniyomi `yuzono/anime-extensions` (`src/es/animeav1`, también en `Kohi-den/extensions-source`).
- Endpoints: popular `/catalogo?order=popular&page=N`, reciente `/catalogo?order=latest_released&page=N`, búsqueda `/catalogo?search=<query>&page=N`.
- Selectores: `article[class*="group/item"]`, `header h3`, `.bg-current img`.
- Episodios: `episodes:[{id,number}, ...]` en un `<script>` inline; URL `<anime-url>/<number>`.
- Fuentes de vídeo: `embeds:{DUB:[...],SUB:[...]}` con entradas `{server:"HLS",url:"https://player.zilla-networks.com/play/<hash>"}`.
- **Alcance de reproducción:** solo el servidor **HLS** es reproducible sin extractores de terceros (`player.zilla-networks.com/play/<hash>` -> `/m3u8/<hash>`). Los demás (UPNShare, Voe, Byse, YourUpload, MP4Upload, VidHide, StreamTape) requieren extractores de JS/descifrado y se omiten de forma explícita.
- Nota histórica: `api.consumet.org` (Consumet) está caído globalmente (HTTP 451); se descartó como fuente de anime.
- WASM: 151732 bytes, sha256 `6d3602f6bdb53781b347d191341628298129eeb3b46be75d51ec5bbe53fe489f`; source id `5029024687956981182`.

## Validación local (Fase 6)

- `crates/ext-sdk`: 10 tests en verde (`cargo test`), incluidos los de `text` con fragmentos reales de AnimeAV1 y de `unicap`.
- Ambas extensiones **compilan a `.wasm`** con cargo-component 0.21.1 (tamaños y sha256 arriba).
- Los cuatro catálogos se generan; `index.pb` **decodifica correctamente** con el esquema `NetworkExtensionStore` de Mihon (nombre de store, `packageName`, `versionCode`, `contentWarning`, source y `homeUrl`).
- **Pendiente (Fase 8):** la validación end-to-end (cargar el `.wasm` en el Worker y ejecutar `buscar()`/`get-manga-pages()`/`get-video-sources()` contra la red real) depende del loader y del host (`packages/ext-loader`, `packages/ext-host`), que aún no existen. El parseo HTML usa la interfaz `parsing` del host; los selectores se eligieron estables (ids/atributos) para minimizar el riesgo de motor CSS.

Ver: `crates/ext-sdk/README.md`, `extension-template/README.md`, `docs/04-wit-extensiones.md`, `docs/00-roadmap.md` (Fase 6), `docs/adr/ADR-007-extensiones-externas.md`.
