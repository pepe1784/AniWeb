# ADR-010: Anime en el núcleo del servidor (capa de anime sobre Suwayomi)

- Estado: Aceptada
- Fecha: 2026-10-11
- Fase: 10 (reformulada)
- Decisores: equipo AniWeb

## Contexto

ADR-008 dejó el anime **fuera del núcleo**: Suwayomi-Server es manga-only y el
anime lo cubrían los runtimes fallback del cliente (JS/Dart y WASM) y, en el APK,
las extensiones nativas Aniyomi. Además ADR-008 fijó la relación con Suwayomi como
**"upstream, no fork"**.

La persona que dirige el proyecto pide ir más lejos: **portar el soporte de anime
de Aniyomi/Nekoyomi al servidor** para no perder funcionalidad y no reimplementar
en el cliente lo que la JVM ya sabe hacer. El planteamiento es: el servidor
ejecuta las extensiones de anime (como ya hace con las de manga), resuelve el
vídeo, y **la web solo consume APIs** (igual que hoy con Suwayomi). Se acepta que
una JVM es pesada, sobre todo en móvil, y se asume el coste cuando aporta
funcionalidad que de otro modo se perdería.

Datos verificados (GitHub, 2026-10-11):

- **El soporte de anime en Suwayomi ya existió y se retiró.** Hubo un cargador de
  extensiones Aniyomi en el servidor (commit
  [`6389899`](https://github.com/Suwayomi/Suwayomi-Server/commit/6389899507267c1e24c2f7b0a4dc36d0ea10537c))
  que murió por falta de interés: "porque las WebUI no podían usarlo y las UI de
  escritorio no querían añadir soporte" (issue
  [#387](https://github.com/Suwayomi/Suwayomi-Server/issues/387), comentario de
  Robonau). **El bloqueo histórico no fue técnico: fue la UI.**
- **Existe un PR abierto que reañade el anime al servidor**:
  [Suwayomi-Server PR #1876 "Add anime support"](https://github.com/Suwayomi/Suwayomi-Server/pull/1876)
  (KolbyML, 26-ene-2026), listo para revisión, con cambios solicitados por
  Syer10. Toca `anime/AnimeAPI.kt`, migraciones `M0054_AddAnimeExtensionTables` y
  `M0055_AddAnimeTable` (tablas `AnimeExtensionTable`, `AnimeSourceTable`,
  `Anime`) y `NetworkHelper`. La revisión pide, además: **metadata de Source,
  Anime y Episodios**; **no añadir REST salvo lo imprescindible** (iconos,
  thumbnails, proxy de vídeo) y hacer el resto por **GraphQL**.
- **La API de fuentes de anime de Aniyomi está definida y estable en su forma
  actual** (`eu.kanade.tachiyomi.animesource`, extensions-lib 16/17):
  `AnimeSource` / `AnimeCatalogueSource` con
  `getPopularAnime(page)`, `getLatestUpdates(page)`,
  `getSearchAnime(page, query, filters)`, `getAnimeEpisodeUpdate(...)`,
  `getAnimeSeasonUpdate(...)`, `getHosterList(episode)`, `getVideoList(hoster)` y
  `getRelatedAnimeList(...)`; modelos `SAnime`, `SEpisode`, `Video`, `Hoster`,
  `AnimesPage`, `AnimeFilterList`, `AnimeRelation`. Existen variantes RxJava
  obsoletas.
- **Aniyomi upstream está en declive** (su mantenedor dejó el proyecto y las
  extensiones nuevas dejan de ser compatibles); **Nekoyomi**
  ([`Seguaz/Nekoyomi`](https://github.com/Seguaz/Nekoyomi), Apache-2.0) es un fork
  vivo que añade: series personalizadas (agrupación), migración masiva,
  prioridad/filtrado de fuentes, subtítulos online (OpenSubtitles), biblioteca de
  anime separada, historial, organización y personalización profunda, y
  reproductor basado en `mpv`. Existen otros forks de anime (Animiru, enfocado
  solo en anime).

## Decisión

1. **AniWeb Server = Suwayomi-Server + capa de anime.** Se adopta un **fork/parche
   controlado** (no un fork total): se consume Suwayomi upstream y se mantiene
   encima una **capa de anime delgada** (módulo `anime/`) rebasable, partiendo del
   PR #1876 y del `source-api` de Aniyomi/Nekoyomi.
2. **Runner de extensiones de anime en el servidor**: reutiliza el cargador dex
   (`AndroidCompat`) para cargar y ejecutar **extensiones de anime Aniyomi**,
   añadiendo sus tablas y tipos (`AnimeExtension`, `AnimeSource`, `Anime`,
   `Episode`, `Video`) **con metadata** (título, autor, género, estado, duración,
   número de episodio, etc.).
3. **Contrato: GraphQL como vía principal**, con REST mínimo solo para lo que no
   encaja en GQL (iconos, thumbnails, proxy/segmentos de vídeo).
4. **Resolución de vídeo server-side**: `getHosterList`/`getVideoList` y los
   extractores de Aniyomi (desempaquetadores JS, AES, etc.) corren en el servidor,
   que devuelve al cliente las URLs y/o proxies reproducibles. La resolución
   **nunca** ocurre en el navegador.
5. **Paridad de funciones con Nekoyomi** como objetivo conjunto servidor + cliente:
   prioridad/filtrado de fuentes, migración, series personalizadas (agrupación),
   subtítulos online, biblioteca de anime separada, historial, descargas y
   reproductor (ADR-013). El detalle vive en `docs/11-anime.md`.
6. **El camino manga no cambia**: la capa de anime es **aditiva**; la API y el
   cliente de manga siguen igual que upstream.
7. **Modifica ADR-008**: sus puntos 4 ("el anime no lo cubre el servidor; lo
   cubren los runtimes del cliente") y 5 ("upstream, no fork") quedan
   **superados** por esta ADR. El resto de ADR-008 (núcleo self-hosted, clientes
   finos, extensiones multi-runtime) sigue en pie.

## Alternativas consideradas

### Opción A: Capa de anime en el servidor, fork/parche controlado (elegida)

- Pros: máxima funcionalidad de anime (extensiones nativas Aniyomi, extractores,
  WebView/cookies, download server-side); el cliente queda ligero y sin CORS; se
  apoya en un PR existente (#1876) y en un `source-api` estable; resuelve
  exactamente lo que bloqueó el soporte histórico (falta de UI), porque AniWeb
  aporta la UI.
- Contras: se mantiene un parche JVM sobre upstream (rebase); Aniyomi upstream
  está en declive; coste de CPU/memoria en el servidor (más aún si es un móvil);
  hay que portar y probar los extractores de vídeo.

### Opción B: Solo runtimes fallback en el cliente (JS/Dart + WASM), statu quo de ADR-008

- Pros: sin fork; el cliente ya tiene el runtime WASM.
- Contras: pierde los extractores nativos, las sesiones/cookies y el WebView;
  universo de anime mucho menor; es la vía que la persona ha descartado como
  principal.

### Opción C: Esperar a que el anime se fusione upstream

- Pros: cero mantenimiento de fork.
- Contras: el PR #1876 lleva meses abierto con cambios pedidos y el histórico
  demuestra que upstream no prioriza el anime; además upstream no aporta la UI, que
  es justamente el bloqueo. No es viable como plan principal.

### Opción D: APK nativo (Aniyomi/Nekoyomi) como única vía de anime

- Pros: cobertura máxima sin tocar el servidor.
- Contras: ata el anime a Android y a las políticas de Google; deja fuera a la PWA.
  Se conserva como vía **secundaria** del APK, no como principal.

## Consecuencias

### Positivas

- El anime deja de ser un parche de cliente y pasa a tener un motor en el servidor
  con el ecosistema de extensiones Aniyomi.
- El cliente (PWA y APK) no sufre CORS, cookies ni extractores: solo consume API.
- Se cubre el bloqueo histórico (falta de UI) y se aprovecha un PR ya escrito.
- Un único modelo mental para manga y anime: fuentes, biblioteca, descargas,
  historial y tracking en el servidor.

### Negativas / compromisos

- **Fork/parche a mantener**: la capa de anime debe rebasarse sobre Suwayomi
  upstream. Se documenta como coste permanente.
- **Dependencia de Aniyomi**: su upstream está en declive; la capa hereda los
  cambios de `source-api` y de las extensiones (algunas ya incompatibles). Nekoyomi
  mitiga pero no elimina el riesgo.
- **Coste de recursos**: ejecutar extensiones y resolver vídeo consume CPU/RAM en
  el servidor; en un servidor-móvil puede ser notable.
- **Superficie legal/abuso**: el servidor resuelve y sirve enlaces de vídeo;
  responsabilidad del usuario (self-hosted).
- **Divergencia de la API**: se extiende el esquema GraphQL (nuevos tipos de
  anime); requiere mantener el cliente alineado.

## Referencias

- `docs/11-anime.md` (plano de la fase de anime)
- `docs/adr/ADR-008-nucleo-servidor-suwayomi.md` (puntos 4 y 5 superados)
- `docs/adr/ADR-009-cliente-suwayomi-webui.md`, `docs/adr/ADR-011-aniweb-runtime-servidor.md`,
  `docs/adr/ADR-012-catalogos-y-repositorios.md`, `docs/adr/ADR-013-reproductor-anime.md`
- Suwayomi-Server PR #1876, issue #387, commit `6389899`
- Aniyomi `source-api` (`eu.kanade.tachiyomi.animesource`), Nekoyomi (`Seguaz/Nekoyomi`), Animiru
