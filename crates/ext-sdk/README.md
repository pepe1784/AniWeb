# crates/ext-sdk

SDK Rust para escribir extensiones AniWeb sobre wit-bindgen:

- Bindings Rust generados desde `packages/ext-api/wit/extension.wit` (stub pendiente desde la Fase 4).
- Helpers ergonómicos: peticiones tipadas, parser HTML, helpers de JSON,
  helpers de catálogos, base64/hash, logging y storage aislado.

Requisito de toolchain: Rust + wit-bindgen (la plantilla `extension-template/`
ya usa cargo-component 0.21.1 / wit-bindgen 0.41, ver su README). Se implementa
en la Fase 6 junto a las extensiones de ejemplo (`extensions/`).

Ver: `docs/00-roadmap.md` (Fase 6), `docs/04-wit-extensiones.md`.