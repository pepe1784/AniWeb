# ADR-006: Pipeline de procesamiento (WebGPU con fallback)

- Estado: Aceptada
- Fecha: 2026-10-09
- Fase: 2
- Decisores: equipo AniWeb

## Contexto

Se quieren mejoras opcionales: reescalado de video estilo Anime4K, mejora de páginas de manga y OCR/traducción local (ONNX/Transformers.js). El soporte de WebGPU no es universal: Chrome/Edge y Safari 26+ sí, pero **Firefox aún lo mantiene deshabilitado por defecto** (2026). Las funciones de mejora no pueden ser requisitos.

## Decisión

Pipeline **opcional y por capacidades**, con tres niveles detectados en runtime:

1. **WebGPU (compute WGSL)** si `navigator.gpu` y hay adaptador.
2. **Fallback WebGL2** (shaders de fragmento) si no hay WebGPU.
3. **Fallback Canvas2D / WASM SIMD** para operaciones simples.

Reglas:

- Detección de capacidades al inicio y **desactivación automática** si no hay soporte.
- La UI debe indicar el nivel activo y permitir forzar el fallback.
- Nada de la reproducción/lectura depende de este pipeline.
- OCR/traducción con `onnxruntime-web` o Transformers.js; backend WebGPU si existe, si no WASM (con aviso de rendimiento).

## Alternativas consideradas

### Opción A: WebGPU primero con fallback WebGL/Canvas (recomendada)

- Pros: mejor rendimiento donde hay soporte; plan B sólido en todas partes; cumple la restricción de "opcional".
- Contras: mantener dos (o tres) rutas de shaders; más tests.

### Opción B: Solo WebGL2

- Pros: soporte casi universal; una sola ruta.
- Contras: deja fuera la aceleración de compute de WebGPU; menos futuro.

### Opción C: Solo WebGPU

- Pros: más simple de código, máximo rendimiento.
- Contras: inutilizable en Firefox por defecto; rompe la premisa de funcionalidad núcleo. Descartada.

## Consecuencias

### Positivas

- Mejora visual real donde el hardware lo permite, sin bloquear a nadie.
- Preparado para cuando Firefox active WebGPU por defecto.

### Negativas / compromisos

- Doble/triple implementación de shaders y pruebas de compatibilidad.
- El OCR/traducción local en CPU (WASM) puede ser lento; se documentará como experimental.

## Referencias

- `docs/01-viabilidad-navegador-pwa.md` (sección 7; decisión A4)
- Fase 9 (MVP lector/reproductor/WebGPU) del roadmap
