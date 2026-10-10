# Plantilla de repo de extensiones AniWeb

Plantilla lista para crear un **repo de extensiones** AniWeb: varias extensiones
Rust en el mismo repositorio, cada una compilada a un componente WebAssembly
(WIT), con SHA-256 por artefacto y un catálogo publicado en cuatro formatos:

| Archivo | Formato | Consumidor |
| --- | --- | --- |
| `index.json` | catálogo nativo AniWeb (spec `docs/04-wit-extensiones.md`) | la app AniWeb |
| `index.min.json` | catálogo legacy del ecosistema (array) | herramientas estilo Mihon/Tachiyomi |
| `index.pb` | catálogo v2 del ecosistema (protobuf) | herramientas estilo Mihon |
| `repo.json` | redirect legacy (`index_v2` -> `index.pb`) | flujo legacy |

Los formatos del ecosistema siguen los esquemas de
Mihon (`NetworkExtensionStore`), verificados contra
`keiyoushi/extensions`. Los artefactos son componentes WASM, no APK: el
ecosistema solo comparte la *forma* del catálogo, no el binario.

Contrato de la extensión: `extensions/<id>/wit/extension.wit` (spec en
`docs/04-wit-extensiones.md` del proyecto AniWeb). El runtime del host ejecuta
la extensión en un Web Worker aislado: sin DOM y sin red directa (todo pasa por
`http.request` con los dominios declarados en `extension-metadata.json`).

## Estructura

```
extension-template/
├── extension-repo.json          config del repo (nombre, web, badge, firma)
├── extensions/
│   └── example/                 una extension por carpeta (id == carpeta)
│       ├── Cargo.toml           crate (cdylib + metadata.component)
│       ├── src/lib.rs           implementacion de extension-api (stub)
│       ├── wit/extension.wit    contrato WIT (sincronizado con packages/ext-api)
│       └── extension-metadata.json  id, name, lang, nsfw, kind, version, sites...
├── scripts/build-index.mjs      SHA-256 + los 4 catalogos + copia de .wasm
├── .github/workflows/release.yml  matriz de build -> store -> gh-pages
├── .gitignore                   target/, dist/, store/, bindings.rs
└── README.md
```

`extensions/<id>/src/bindings.rs`, `dist/` y `store/` se generan; no se editan
a mano.

## Requisitos

Para trabajo local (opcional, la CI lo hace todo):

- Rust stable + target `wasm32-wasip1` (`rustup target add wasm32-wasip1`).
- `cargo-component` **0.21.1** (`cargo install cargo-component --version 0.21.1 --locked`).
- Node.js 20+ (para `scripts/build-index.mjs`).

Receta local en Windows (toolchain GNU, `target/` fuera del repo): ver
`docs/06-ext-sdk.md` del proyecto AniWeb.

## Crear una extensión

1. Usa este directorio como plantilla de repo (o copialo a un repo nuevo) y
   edita `extension-repo.json` con los datos de tu repo.
2. Crea `extensions/<id>/` a partir de `extensions/example/`:
   - `extension-metadata.json`: `id` (igual al nombre de la carpeta), `name`,
     `lang`, `nsfw`, `kind`, `version`, `sites`, `min-api-version`.
   - `src/lib.rs`: constante `EXTENSION_ID` (debe coincidir con `id`) e
     implementa las funciones que apliquen; lo no soportado devuelve
     `Err(Error::NotSupported)`.
   - `Cargo.toml`: `name` del crate y `description`.
   - `wit/extension.wit`: copia sincronizada del contrato.
3. Compila en local (si tienes toolchain):
   `cargo component build --release --manifest-path extensions/<id>/Cargo.toml`
   y copia el `.wasm` a `dist/<id>.wasm`.
4. Genera el store en local: `node scripts/build-index.mjs`.
5. Publica: crea un tag `vX.Y.Z` (los tags solo disparan el release; la
   **versión real de cada extensión** sale de su `extension-metadata.json`) y
   haz push. La CI compila cada extensión, genera el store y lo publica en la
   rama `gh-pages`.
6. En el repo: Settings -> Pages -> Source: "GitHub Actions".
7. El catálogo nativo queda en `https://<usuario>.github.io/<repo>/index.json`.
   Añádelo como repositorio de extensiones en la app.

En PRs, la CI compila y valida el catálogo sin publicar.

## `extension-metadata.json`

Campos de una extensión:

| Campo | Necesario | Descripcion |
| --- | --- | --- |
| `id` | si | identificador unico; igual al nombre de la carpeta y a `EXTENSION_ID`/`id()` |
| `name`, `lang`, `nsfw` | si | presentacion (`nsfw`: `safe`\|`suggestive`\|`nsfw`) |
| `kind` | si | `manga`, `anime` o `both` |
| `version` | si | semver `x.y.z` (el `versionCode` del ecosistema sale de aqui) |
| `min-api-version` | no | version del WIT (por defecto la de `extension-repo.json`) |
| `sites` | si | dominios autorizados para `http.request` |
| `default-proxy` | no | proxy sugerido (el usuario puede cambiarlo) |
| `package-name` | no | id del paquete en el ecosistema (por defecto `aniweb.extension.<id>`) |
| `icon` | no | ruta o URL del icono (relativa al store o absoluta) |
| `source-name`, `home-url`, `source-id` | no | una sola fuente sintetica |
| `sources[]` | no | lista de fuentes `{ name, lang, home-url, mirror-urls[], message }` |

Si no se declara `sources[]`, se sintetiza una fuente con `source-name` (o
`name`), `lang`, y `home-url` (o `https://<sites[0]>`).

## Formatos del ecosistema

- `versionCode = major*100000 + minor*1000 + patch` (convencion de la
  plataforma; `1.6.4` -> `106004`).
- `contentWarning`: nativo `safe`/`suggestive`/`nsfw`; legacy `0`/`1`/`2`; v2
  `1`(SAFE)/`2`(MIXED)/`3`(NSFW).
- El `id` de cada `source` es un entero de 64 bits estable derivado de
  `aniweb:extension:<id>` (FNV-1a), o el valor de `source-id` si se declara.
- `repo.json` sigue el redirect legacy: `index_v2` apunta a `index.pb`.

## Firma opcional (minisign)

El SHA-256 garantiza integridad; **minisign** añade autenticidad del publicador.
Es opcional: define el secret `MINISIGN_KEY` (contenido de la clave secreta de
minisign, en Base64) y la CI instalará `minisign`, firmará cada `.wasm` y
embebará la firma en la entrada **nativa** del catálogo. La huella pública se
declara en `extension-repo.json` (`signing-key-fingerprint`).

## Toolchain fijado

- `cargo-component` 0.21.1 empaqueta **wit-bindgen 0.41**, por eso `Cargo.toml`
  usa `wit-bindgen-rt = "0.41.0"`. Al subir de versión `cargo-component`,
  actualiza `wit-bindgen-rt` a la versión correspondiente y prueba en CI.
- WIT no admite tipos recursivos ni casos de variante que sean palabras clave
  (por eso el caso string de JSON es `str`); ver `docs/04-wit-extensiones.md`.

## Sincronizar el contrato WIT

La copia `extensions/<id>/wit/extension.wit` debe coincidir con
`packages/ext-api/wit/extension.wit` del proyecto AniWeb. Cuando el contrato
cambie, actualiza la copia y sube `min-api-version` en el metadata.

## Licencia

El proyecto AniWeb es AGPL-3.0-only. Revisa la licencia aplicable a tu repo de
extensiones antes de publicar.
