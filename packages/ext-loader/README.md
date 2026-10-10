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
| `browser-e2e/` | instanciación real del componente (jco) en un Worker + E2E | validado en Chromium |
| permisos, límites de memoria/tiempo y actualizaciones | pendiente |

Pruebas (Node, sin navegador):

```sh
cd packages/ext-loader && node --test
```

El formato del catálogo está descrito en `docs/04-wit-extensiones.md`.

## E2E de instanciación (navegador)

`browser-e2e/serve.mjs` transpila un componente con `jco`, sirve el componente
junto a los puentes WIT (`packages/ext-host/src/wit-imports`) y los shims WASI
preview2, y levanta el proxy CORS. Un Worker de modulo instancia el componente y
ejecuta funciones reales.

```sh
# requiere jco instalado: cd packages/ext-api && npm install
$env:ANIWEB_E2E_WASM="C:\ruta\ext-repos\manga-oni\dist\manga-oni.wasm"
node packages/ext-loader/browser-e2e/serve.mjs   # abre http://127.0.0.1:8099/test.html
```

Validado con MangaOni: `id()` = `manga-oni` y `searchManga("naruto", 1)` devuelve
9 resultados reales (red por XHR sincrono -> proxy -> `manga-oni.com`).

Nota sobre `jco`: el string WIT (`aniweb:extension/json`, etc.) se usa tanto como
especificador de `import` como **clave del objeto de imports** de los core
modules. Al transpilar para el navegador solo hay que reescribir los
`import ... from '...'`, nunca esas claves internas.

Ver: `docs/00-roadmap.md` (Fase 8), `docs/02-arquitectura.md`.
