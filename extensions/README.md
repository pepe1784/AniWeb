# extensions

Registro de las extensiones de ejemplo de AniWeb. **Las extensiones no viven en
este monorepo**: cada una es un repo externo (estilo Aniyomi/Mihon/Keiyoushi)
creado a partir de `extension-template/`. Aquí solo se documentan.

## Repos externos de ejemplo (Fase 6)

Creados en `C:\Users\<usuario>\Desktop\ext-repos\` (fuera del monorepo, con git
propio). Estructura multi-extensión lista para añadir más fuentes.

| Repo local | Fuente | Tipo | Sitio | Origen del portado |
| --- | --- | --- | --- | --- |
| `ext-repos/manga-oni` | MangaOni (`manga-oni`) | manga, es | `https://manga-oni.com` | cliente libre `rubnmv7/MangaChoped` + HTML real |
| `ext-repos/animeav1` | AnimeAV1 (`animeav1`) | anime, es | `https://animeav1.com` | `yuzono/anime-extensions` (`src/es/animeav1`) |

- Consumet (`api.consumet.org`) se descartó: responde HTTP 451 (Unavailable For Legal Reasons), un bloqueo legal/derechos de autor, no una caída técnica.
- Ambas compilan a componente WASM con cargo-component 0.21.1 y generan los 4
  catálogos del ecosistema (`index.json`, `index.min.json`, `index.pb`,
  `repo.json`); `index.pb` decodifica con el esquema `NetworkExtensionStore`.
- Reproducción de anime: solo el servidor **HLS** (`player.zilla-networks.com`)
  es reproducible sin extractores de terceros; el resto se omite de forma
  explícita.

## Plantilla

`extension-template/` genera un repo de extensiones vacío (multi-extensión) con
`Cargo.toml`, WIT, CI que compila a WASM, calcula el SHA-256 y publica el
catálogo.

Ver: `docs/06-ext-sdk.md`, `docs/adr/ADR-007-extensiones-externas.md`,
`extension-template/README.md`, `docs/04-wit-extensiones.md`,
`docs/00-roadmap.md` (Fase 6).
