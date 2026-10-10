# ADR-007: Extensiones en repos externos y portado de fuentes (no conversión de APK)

- Estado: Aceptada
- Fecha: 2026-10-10
- Fase: 6
- Decisores: equipo AniWeb

## Contexto

El objetivo es un lector/reproductor de anime y manga en la web (PWA), sin instalar APKs, pero con la misma riqueza de fuentes que Aniyomi/Tachiyomi. El ecosistema existente (Aniyomi, Mihon/Tachiyomi, Keiyoushi) distribuye fuentes como **APKs** con código Android. Se planteó si era posible "traducir" esos `.apk` a extensiones `.wasm`.

Además, el monorepo AniWeb debe permanecer como núcleo (app + contrato + SDK) y no convertirse en un vertedero de fuentes.

## Decisión

### 1. Las extensiones viven en repos externos

El monorepo aporta el contrato (`packages/ext-api/wit/extension.wit`), el SDK (`crates/ext-sdk`) y la plantilla (`extension-template/`). Cada repo de extensiones es un proyecto aparte con git propio y estructura **multi-extensión** (`extensions/<id>/`), publicable como una "tienda" (`index.json`, `index.min.json`, `index.pb`, `repo.json`). `extensions/` en el monorepo solo documenta y registra los repos externos de ejemplo.

### 2. Se **porta** el código fuente, no se traduce el APK

Un APK es código Dalvik/ART con acceso al framework Android, `OkHttp`, Jsoup nativo y extractores que usan `javax.crypto`. No hay traducción automática fiable a un componente WASM sandbox. La vía es reescribir la fuente en Rust sobre `crates/ext-sdk`, partiendo de fuentes abiertas (Apache-2.0):

- Anime: `Kohi-den/extensions-source`, `yuzono/anime-extensions`.
- Manga: `keiyoushi/extensions-source`.

Lo que depende de extractores Android (JS ofuscado, AES con clave fija, WebView) **no** se porta; se documenta como no soportado para esa fuente.

### 3. Ejemplos de la Fase 6

- **MangaOni** (`manga-oni.com`), manga en español.
- **AnimeAV1** (`animeav1.com`), anime en español, portado de `yuzono/anime-extensions`.

Consumet (`api.consumet.org`) se descarta: responde HTTP 451 (Unavailable For Legal Reasons), un bloqueo por motivos legales/derechos de autor (no una caída técnica).

## Alternativas consideradas

### Opción A: Repos externos + portado a WASM (recomendada)

- Pros: monorepo limpio; cada repo evoluciona y se publica solo; contrato/SDK estables son la única dependencia; licencias respetadas (portado con atribución).
- Contras: hay que reescribir cada fuente; los extractores propietarios se pierden.

### Opción B: Un convertidor `.apk` -> `.wasm`

- Pros: reutilizar cientos de fuentes sin reescribir.
- Contras: técnicamente inviable y engañoso (Dalvik/ART + framework Android + cripto nativa). Descartada.

### Opción C: Extensiones dentro del monorepo

- Pros: un solo repo, PRs centralizados.
- Contras: rompe la separación núcleo/fuentes, infla el repo y aleja del modelo del ecosistema. Descartada.

## Consecuencias

### Positivas

- Núcleo AniWeb pequeño y estable; fuentes desacopladas y versionadas por separado.
- Compatibilidad de *forma* con el ecosistema: se emiten `index.min.json` e `index.pb` (esquemas de Mihon) además del catálogo nativo.
- Honestidad sobre límites: HLS directo reproducible; extractores JS/AES fuera de alcance, documentados.

### Negativas / compromisos

- Cada fuente nueva implica trabajo manual de portado.
- Los selectores dependen del HTML del sitio; pueden romperse y requieren mantenimiento.
- La validación end-to-end llega en la Fase 8 (loader/host aún no existen); la Fase 6 cubre compilación a `.wasm` y validación de catálogos.

## Referencias

- `docs/06-ext-sdk.md`
- `docs/04-wit-extensiones.md`
- `crates/ext-sdk/README.md`, `extension-template/README.md`
- Fase 6 del roadmap (`docs/00-roadmap.md`)
