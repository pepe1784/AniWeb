# ADR-003: Toolchain del runtime de extensiones

- Estado: Propuesta
- Fecha: 2026-10-09
- Fase: 2
- Decisores: equipo AniWeb

## Contexto

Las extensiones deben ser módulos WASM en Workers aislados, con una API nueva (no compatible con APKs de Aniyomi) y sin acceso al DOM ni a la red directa. Hay que elegir cómo se define la interfaz host/guest y con qué herramientas se compila y ejecuta. Se pidió evaluar `jco` y `wasm-bindgen`.

## Decisión

Definir la interfaz en **WIT (WebAssembly Component Model)**. Las extensiones se escriben en **Rust** y compilan a un **componente WASM** (`cargo-component` / `wit-bindgen` → `wasm32-wasip2`). El host (navegador, TypeScript) integra el componente con **`jco`**, que transpila el componente a un módulo JS ejecutable en un Web Worker y permite inyectar las *host functions* como imports. `wasm-bindgen` queda como **herramienta de apoyo puntual**, no como contrato principal.

## Alternativas consideradas

### Opción A: WIT + Component Model, host con `jco` (recomendada)

- Pros: contrato tipado y estable en WIT; independiente del lenguaje (Rust hoy, AssemblyScript u otros mañana); aislamiento limpio; `jco` ejecuta componentes en el navegador; encaja con "API nueva".
- Contras: ecosistema joven; el host debe implementar los imports (WASI + los propios); tooling en evolución; depuración más compleja.

### Opción B: `wasm-bindgen` clásico

- Pros: muy maduro; enorme ejemplos; genera glue JS automáticamente.
- Contras: acopla el guest a la ABI de Rust/JS; no es Component Model; mezcla el contrato con detalles de implementación; portabilidad a otros lenguajes peor.

### Opción C: AssemblyScript como lenguaje de extensiones

- Pros: sintaxis cercana a TypeScript; sin toolchain de Rust.
- Contras: soporte del Component Model y del toolchain menos maduro; ecosistema de parsing/crypto más pobre que Rust; se mantiene como alternativa futura, no como principal.

## Consecuencias

### Positivas

- Interfaz única y documentada en WIT (`packages/ext-api/wit`).
- Sandbox fuerte y portable; extensiones de terceros reproducibles y verificables por hash.
- Un mismo contrato sirve para manga y anime.

### Negativas / compromisos

- Curva de aprendizaje del Component Model y de `jco`.
- Si `jco` presenta carencias, puede requerir un adaptador o usar `wasm-bindgen` para piezas concretas; se revisará en la Fase 4/8.

## Referencias

- `docs/02-arquitectura.md`
- Fase 4 (interfaz WIT) y Fase 8 (loader) del roadmap
