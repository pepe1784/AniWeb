# browser-check

Banco de pruebas manual del host `http` (Fase 8) en un navegador real. Sirve
para comprobar que **XMLHttpRequest sincrono** funciona dentro de un Web Worker
(ejecutando el codigo real de `src/http.mjs`) contra el proxy de la Fase 7.

## Uso

```sh
node packages/ext-host/browser-check/serve.mjs
```

Levanta en un mismo proceso:

- `http://127.0.0.1:8099` — origen destino + estaticos + modulos del host:
  - `/test.html`, `/worker.js` (Worker de tipo modulo que importa el host real)
  - `/src/*.mjs` — sirve `packages/ext-host/src/*` tal cual
  - `/target` — texto (GET simple)
  - `/img` — 256 bytes binarios con `Range` (206)
- `http://127.0.0.1:8787` — proxy CORS (nucleo de la Fase 7)

Abre `http://127.0.0.1:8099/test.html`. El resultado (JSON) aparece en la pagina
y en `document.title`.

Resultado esperado (validado en Chromium):

```json
{"text":{"status":200,"body":"hello from target"},
 "range":{"status":206,"count":10,"first":0},
 "blocked":{"tag":"blocked"}}
```

- `text`: peticion permitida via proxy, sin Range -> 200.
- `range`: permitida con `Range: bytes=0-9` -> 206, 10 bytes.
- `blocked`: dominio fuera del manifiesto -> error `blocked` sin tocar la red.

Es una prueba manual (requiere navegador); la logica del host se cubre con
`node --test` sin navegador.
