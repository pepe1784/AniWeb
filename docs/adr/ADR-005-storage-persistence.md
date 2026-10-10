# ADR-005: Almacenamiento y persistencia

- Estado: Aceptada
- Fecha: 2026-10-09
- Fase: 2
- Decisores: equipo AniWeb

## Contexto

Hay que guardar dos tipos muy distintos de datos: (a) metadatos estructurados (biblioteca, historial, categorías, ajustes) y (b) blobs binarios (páginas de manga descargadas). Además, iOS puede purgar el almacenamiento (ver sección 5 de la viabilidad) y las cuotas son finitas. Se necesita una estrategia explícita.

## Decisión

- **IndexedDB** (a través de `idb`) para metadatos estructurados y consultas.
- **OPFS** (`navigator.storage.getDirectory()`) para blobs: páginas descargadas y cachés binarias.
- **`navigator.storage.persist()`** solicitado en el primer uso significativo (no en el arranque), con UI de estado.
- **Evicción LRU** por capítulo/página, con **límite de almacenamiento configurable** y panel de uso (`navigator.storage.estimate()`).
- **Backup local primero:** exportar/importar JSON de metadatos siempre disponible; sync externo (AniList/Gist) opcional.
- El **SW nunca** almacena video completo (ver ADR-002).

## Alternativas consideradas

### Opción A: IndexedDB + OPFS (recomendada)

- Pros: separa metadatos de blobs; OPFS es eficiente para binarios y accesible desde Workers; ambas ampliamente soportadas; encaja con descargas y caché.
- Contras: OPFS más lento en Safari; hay que gestionar cuotas y purga; más piezas que mantener.

### Opción B: Solo IndexedDB (blobs como `Blob`)

- Pros: una única API; transaccional.
- Contras: peor rendimiento para blobs grandes; límites prácticos; menos eficiente en descargas.

### Opción C: Cache Storage para páginas

- Pros: sencillo con SW.
- Contras: pensado para respuestas HTTP; no para gestos de datos/evicción fina; mezcla la caché de app con datos de usuario.

### Opción D: File System Access API

- Pros: archivos reales visibles al usuario.
- Contras: solo Chromium de escritorio; descartado como base (posible extra opcional).

## Consecuencias

### Positivas

- Offline-first real para manga, con descargas y evicción controlables.
- Migraciones de esquema gestionadas en IndexedDB.

### Negativas / compromisos

- En iOS, `persist()` puede denegarse y el navegador puede purgar: la UI debe avisar y ofrecer exportación.
- Hay que implementar versionado/migraciones y política LRU desde el inicio.

## Referencias

- `docs/01-viabilidad-navegador-pwa.md` (secciones 4, 5, 6; decisiones A6, A7)
- ADR-002 (Service Worker)
