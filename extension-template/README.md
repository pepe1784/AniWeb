# Plantilla de extensión AniWeb

Plantilla lista para crear un **repo de extensiones** de AniWeb a partir de
ella: una extensión Rust que compila a un componente WebAssembly (WIT), se
publica con su hash SHA-256 y expone un catálogo `index.json` consumible por la
app.

Contrato de la extensión: `wit/extension.wit` (spec en `docs/04-wit-extensiones.md`
del proyecto AniWeb). El runtime del host ejecuta la extensión en un Web Worker
aislado: sin DOM y sin red directa (todo pasa por `http.request` con los
dominios declarados en `extension-metadata.json`).

## Estructura

| Ruta | Contenido |
| --- | --- |
| `Cargo.toml` | Crate de la extensión (`crate-type = ["cdylib"]`) |
| `src/lib.rs` | Implementación de `extension-api` (stub a completar) |
| `wit/extension.wit` | Contrato WIT (copia sincronizada del proyecto AniWeb) |
| `extension-metadata.json` | Metadatos que alimentan el catálogo `index.json` |
| `scripts/build-index.mjs` | Calcula SHA-256/tamaño y escribe `store/index.json` |
| `.github/workflows/release.yml` | CI: compila, verifica y publica en `gh-pages` |

`src/bindings.rs` y `store/` se generan; no se editan a mano.

## Requisitos

Para trabajo local (opcional, la CI lo hace todo):

- Rust stable + target `wasm32-wasip1` (`rustup target add wasm32-wasip1`).
- `cargo-component` **0.21.1** (`cargo install cargo-component --version 0.21.1 --locked`).
- Node.js 20+ (para `scripts/build-index.mjs`).

## Crear una extensión

1. Usa este directorio como plantilla de repo (o copialo a un repo nuevo).
2. Edita:
   - `extension-metadata.json`: `id`, `name`, `lang`, `nsfw`, `kind`, `sites`, `version`.
   - `src/lib.rs`: constante `EXTENSION_ID` (debe coincidir con `id` del metadata)
     e implementa las funciones que apliquen. Lo no soportado devuelve
     `Err(Error::NotSupported)`.
   - `Cargo.toml`: `name` del crate y `description`.
3. Compila en local (si tienes toolchain): `cargo component build --release`.
4. Publica: crea un tag `vX.Y.Z` (debe coincidir con `version` del metadata) y
   haz push. La CI compila, verifica el SHA-256, genera `index.json` y lo
   publica en la rama `gh-pages` con el `.wasm`.
5. En el repo: Settings -> Pages -> Source: "GitHub Actions".
6. El catálogo queda en `https://<usuario>.github.io/<repo>/index.json`.
   Añádelo como repositorio de extensiones en la app.

En PRs, la CI compila y valida el catálogo sin publicar.

## Firma opcional (minisign)

El SHA-256 garantiza integridad; **minisign** añade autenticidad del publicador.
Es opcional: define el secret `MINISIGN_KEY` (contenido de la clave secreta de
minisign, en Base64) y la CI instalará `minisign`, firmará el `.wasm` y
embebará la firma en la entrada del catálogo.

## Toolchain fijado

- `cargo-component` 0.21.1 empaqueta **wit-bindgen 0.41**, por eso `Cargo.toml`
  usa `wit-bindgen-rt = "0.41.0"`. Al subir de versión `cargo-component`,
  actualiza `wit-bindgen-rt` a la versión correspondiente y prueba en CI.
- WIT no admite tipos recursivos ni casos de variante que sean palabras clave
  (por eso el caso string de JSON es `str`); ver `docs/04-wit-extensiones.md`.

## Sincronizar el contrato WIT

La copia `wit/extension.wit` debe coincidir con `packages/ext-api/wit/extension.wit`
del proyecto AniWeb. Cuando el contrato cambie, actualiza la copia y sube
`min-api-version` en el metadata.

## Licencia

El proyecto AniWeb es AGPL-3.0-only. Revisa la licencia aplicable a tu repo de
extensiones antes de publicar.