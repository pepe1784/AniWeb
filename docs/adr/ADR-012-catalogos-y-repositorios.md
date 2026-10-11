# ADR-012: Catálogos de repositorio de extensiones (.json, .min.json, .pb) y tipos de medio

- Estado: Aceptada
- Fecha: 2026-10-11
- Fase: 10 (reformulada)
- Decisores: equipo AniWeb

## Contexto

Hay confusión entre dos niveles distintos:

- **Catálogo / índice de repositorio**: el archivo que lista las extensiones de un
  repo. Es **texto/JSON o protobuf**, no un binario ejecutable.
- **Artefacto de extensión**: el binario o fuente que se descarga e instala.

Lo verificado:

- **Mihon/Aniyomi (y Suwayomi)**: el store usa **`index.min.json`** (JSON
  minificado) y **`index.pb`** (protobuf, mismo contenido para herramientas
  Mihon). Los artefactos son `.apk`/`.jar` (dex). AniWeb ya genera ambos índices en
  `extension-template/scripts/build-index.mjs`, pero con orientación Mihon.
- **Mangayomi**: un mismo repo expone **hasta tres catálogos por URL**:
  `index.json` (manga), `anime_index.json` (anime) y `novel_index.json` (novela);
  los artefactos son `.js` o `.dart`. La app añade el repo con
  `mangayomi://add-repo?...&manga_url=...&anime_url=...&novel_url=...`.
- **AniWeb (propio)**: ya existe un catálogo `index.json` **v1** en
  `packages/ext-loader/src/catalog.mjs` (campos `version`, `min-api-version`,
  `updated-at`, `sites`, `wasm{url,sha256,size}` y `kind ∈ {manga, anime, both}`),
  pensado para fuentes WASM.

La persona que dirige el proyecto pide **soportar todos los formatos** y aclarar
que los repos son `.json`/`.min.json`/`.pb` (no `.apk`/`.jar`).

## Decisión

1. **Separar catálogo y artefacto** en todo el código y la documentación:
   - Catálogo (índice): `*.json`, `*.min.json`, `*.pb`.
   - Artefacto: `.apk`/`.jar` (Mihon/Aniyomi, dex), `.js`/`.dart` (Mangayomi),
     `.wasm` (AniWeb).
2. **Soportar los tres formatos de catálogo**: `.json`, `.min.json` y `.pb`
   (protobuf). Se importan y **se normalizan a un modelo interno** único antes de
   usarlos.
3. **Tres tipos de medio**: **manga**, **anime** y **novela**. Manga y anime son
   objetivos; **novela se marca como futuro/opcional** (se reserva el campo pero no
   se implementa todavía), para no divergir del modelo de Mangayomi.
4. **Repos Mangayomi**: se acepta una entrada de repo con **hasta tres URLs**
   (`manga_url`, `anime_url`, `novel_url`) y se importan como catálogos
   independientes.
5. **Repos Mihon/Aniyomi**: `index.min.json` + `index.pb`; su consumo principal es
   el **servidor** (Suwayomi ya lo hace). El cliente solo los muestra.
6. **Repos AniWeb**: se mantiene el `index.json` v1 de `packages/ext-loader` para
   fuentes WASM/JS del "aniweb runtime", documentado como formato propio y
   versionado.
7. **Modelo interno normalizado** (común a todos los formatos), con al menos:
   `CatalogEntry { id, name, mediaType, lang, version, iconUrl, description,
   artifact { kind, url, sha256, size }, repo { url, format } }`.
8. **Importación en el servidor**: los repos se añaden y sincronizan server-side;
   el cliente los lista por API, coherente con ADR-010/ADR-011.

## Alternativas consideradas

### Opción A: Normalizar todos los formatos a un modelo interno (elegida)

- Pros: un solo consumidor (servidor y cliente) entiende todos los repos; fácil
  añadir formatos; distingue catálogo de artefacto.
- Contras: trabajo de parseo de `.pb` y de mapeos por proyecto; hay que versionar el
  modelo interno.

### Opción B: Un formato propio y conversión externa de los demás

- Pros: superficie mínima.
- Contras: obliga al usuario a convertir repos de terceros; rompe la promesa de
  "usar el ecosistema tal cual"; más fricción.

### Opción C: Solo el formato de cada runtime, sin unificar

- Pros: cero abstracción.
- Contras: cada runtime arrastra su propio lector de catálogos; duplicación y
  divergencia. Descartada.

## Consecuencias

### Positivas

- Un repositorio de cualquier ecosistema (Mihon/Aniyomi, Mangayomi, AniWeb) se
  puede añadir y mostrar igual.
- Se aclara de una vez el malentendido catálogo (json/pb) vs artefacto
  (apk/jar/js/dart/wasm).
- Base lista para "novelas" sin diseño nuevo (solo activar el tercer catálogo).

### Negativas / compromisos

- Hay que **parsear y mantener** `index.min.json` y `index.pb` (protobuf) además
  del JSON propio; el `.pb` acopla a un esquema ajeno (Mihon `NetworkExtensionStore`).
- Coexisten **tres formatos** de catálogo: más pruebas y casos límite.
- La "novela" queda declarada pero no implementada: deuda explícita.

## Referencias

- `packages/ext-loader/src/catalog.mjs` (AniWeb `index.json` v1)
- `extension-template/scripts/build-index.mjs` (generación de `.min.json`/`.pb`)
- Mangayomi `kodjodevf/mangayomi-extensions` (3 catálogos), `wotaku.wiki/ext/mangayomi`
- `docs/adr/ADR-007-extensiones-externas.md`, `docs/adr/ADR-010-anime-en-nucleo-servidor.md`,
  `docs/adr/ADR-011-aniweb-runtime-servidor.md`
- `docs/11-anime.md`
