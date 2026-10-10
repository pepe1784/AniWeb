# ADR-001: Framework de frontend

- Estado: Propuesta
- Fecha: 2026-10-09
- Fase: 2
- Decisores: equipo AniWeb

## Contexto

La PWA necesita una UI reactiva para un lector (listas largas, scroll continuo, zoom) y un reproductor (estado de media, controles), con bundle pequeño y buen soporte de Vite/PWA. La entrega es 100% estática y cliente. Restricción del proyecto: TypeScript + Vite, con **Svelte** o **SolidJS** como candidatos.

## Decisión

Usar **Svelte 5 (runes) + Vite en modo SPA** (sin SSR) con un enrutador de cliente ligero. El renderizado es enteramente en cliente; no se usa SvelteKit de entrada.

## Alternativas consideradas

### Opción A: Svelte 5 + Vite (SPA)

- Pros: bundles pequeños; reactividad fina por runes; excelente DX; ecosistema amplio; integración directa con Vite y `vite-plugin-pwa`; componentes de terceros para listas virtuales y media.
- Contras: sintaxis propia (menos transferible que JSX); el SPA puro requiere un enrutador aparte; runes es una API relativamente reciente.

### Opción B: SolidJS + Vite

- Pros: rendimiento sobresaliente (reactividad fina sin VDOM); JSX familiar; ideal para UI muy dinámica.
- Contras: ecosistema y librerías de UI menores; SolidStart menos maduro; menos ejemplos de PWA complejas.

### Opción C: React + Vite

- Pros: ecosistema enorme.
- Contras: bundle mayor; el VDOM añade coste en listas largas del lector; más trabajo para acercarse a la fluidez de A/B.

### Opción D: Vue 3 + Vite

- Pros: buen equilibrio DX/ecosistema.
- Contras: no está entre las opciones planteadas para el proyecto.

## Consecuencias

### Positivas

- Buen rendimiento y bundle pequeño para lector/reproductor.
- Integración sencilla con la estrategia PWA (ADR-002) y con hosting estático (Fase 3).
- Comunidad amplia para resolver dudas de Svelte 5.

### Negativas / compromisos

- Se asume un enrutador de cliente propio o ligero (no file-based routing).
- Si en el futuro se necesita SSR/prerender o routing por archivos, habría que evaluar SvelteKit con `adapter-static` como ADR nueva.

## Referencias

- `docs/02-arquitectura.md`
- `docs/01-viabilidad-navegador-pwa.md` (decisión A3 sobre targets)
