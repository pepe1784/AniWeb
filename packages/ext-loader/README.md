# packages/ext-loader

Carga las extensiones del catálogo (WASM componente) en Web Workers aislados:

- Descarga y verificación SHA-256 (WebCrypto) contra el catálogo `index.json`.
- Firma minisign opcional (cuando el repo la incluya).
- Instanciación del componente WASM con `jco` en un Worker por extensión.
- Permisos derivados del manifest (dominios autorizados) y límites de
  memoria/tiempo por llamada.
- Política de actualizaciones (version/updated-at del catálogo).

## Estado (Fase 8, en curso)

| Módulo | Responsabilidad | Estado |
| --- | --- | --- |
| `src/verify.mjs` | SHA-256 (WebCrypto) + tamaño del `.wasm` contra el catálogo | listo + tests |
| instanciación en Worker (jco) | pendiente (depende de la decisión async del WIT) | pendiente |
| permisos, límites de memoria/tiempo y actualizaciones | pendiente |

Pruebas (Node, sin navegador):

```sh
cd packages/ext-loader && node --test
```

El formato del catálogo está descrito en `docs/04-wit-extensiones.md`.

Ver: `docs/00-roadmap.md` (Fase 8), `docs/02-arquitectura.md`.
