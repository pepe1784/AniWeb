# extensions

Extensiones de ejemplo de AniWeb (manga y anime), publicables como repos de
extensiones con la plantilla `extension-template/`.

- Manga de ejemplo con API pública y CORS abierto (p. ej. MangaDex).
- Anime de ejemplo con API pública y legal (p. ej. vídeo directo o JSON de episodios).

Cada extensión es su propio crate Rust; la CI compila el componente WASM,
calcula el SHA-256 y publica su catálogo. Se implementan en la Fase 6 sobre
`crates/ext-sdk`.

Ver: `docs/00-roadmap.md` (Fase 6), `extension-template/README.md`, `docs/04-wit-extensiones.md`.