# ADR-009: Cliente base = Suwayomi-WebUI (reemplaza la UI propia)

- Estado: Aceptada
- Fecha: 2026-10-10
- Fase: 9 (reformulada)
- Decisores: equipo AniWeb

## Contexto

ADR-008 pivoteó a un **núcleo de servidor Suwayomi self-hosted** con clientes
finos. Sin embargo, el cliente se implementó como una **UI propia** (Svelte 5 +
Vite, ADR-001 / ADR-002) que reimplementaba a mano biblioteca, explorar, detalle,
lector y ajustes contra la API REST del servidor.

El resultado fue un cliente **incompleto y muy inferior** al que el propio
proyecto Suwayomi ya ofrece: la WebUI oficial es un cliente maduro (React 19 +
MUI) con lector completo (modos, escalas, temas, descargas, historial, OPDS,
multi-usuario, i18n, actualizaciones) que además el servidor **incluye y
autoactualiza**. Reimplementar eso no aporta valor y multiplica el mantenimiento.

La persona que dirige el proyecto pidió expresamente **tomar la WebUI de
Suwayomi como base** y **eliminar** la UI propia y sus registros.

Datos verificados (GitHub, 2026-10-10):

- **Suwayomi-WebUI** (`Suwayomi/Suwayomi-WebUI`): cliente por defecto del servidor,
  **MPL-2.0**. React 19 + MUI + Apollo (GraphQL) + Vite + `vite-plugin-pwa`.
  `packageManager: pnpm@11.1.2`, `engines.node >= 24.20.0`. Compilación a `build/`.
- El servidor embebe esta WebUI y la **autoactualiza**; también se puede alojar
  por separado (la propia build online `suwayomi-webui-preview.github.io` lo hace y
  permite fijar el host del servidor en Ajustes, clave `serverBaseURL` en
  `localStorage`).
- La build de la WebUI asume **raíz de dominio** (`base: './'` + `<base href='/'>`
  inyectado y rutas absolutas de iconos/manifest), igual que la build online, que
  es un *user site* en la raíz.

## Decisión

1. **Base del cliente = Suwayomi-WebUI**, vendorizada en **`web/`** (copia del
   upstream `Suwayomi/Suwayomi-WebUI`, commit `4914fb1`, 2026-10-07), **conservando
   sus avisos de licencia MPL-2.0** (archivo `web/LICENSE`, cabeceras por archivo,
   README y documentación del proyecto original).
2. **Entrega principal = servida por el propio servidor Suwayomi**, en el mismo
   origen que la API (`http://<servidor>:4567`). Es la vía sin CORS ni WebSocket
   cruzado, y la que el servidor ya mantiene actualizada. El APK webview apunta a
   ese mismo origen.
3. **`web/` es la base a extender** para el valor propio de AniWeb (soporte de
   anime, integración de los runtimes fallback JS/WASM) y se puede **compilar
   aparte** con `pnpm install --frozen-lockfile && pnpm build` → `web/build`.
   El hosting estático independiente asume **raíz de dominio** (ver nota).
4. **Se elimina** la UI propia: la carpeta `app/` (Svelte 5 + Vite + cliente REST),
   su documentación (`docs/09-app.md`, `docs/11-suwayomi-api.md`) y su CI de
   despliegue. La decisión deja sin efecto, para el cliente, ADR-001 (framework de
   frontend propio) y ADR-002 (estrategia PWA propia): la WebUI trae su propio
   framework y su propia configuración `vite-plugin-pwa`.
5. Los **runtimes fallback** (`packages/ext-loader`, `packages/ext-host`,
   `packages/ext-api`, `crates/ext-sdk`, `proxy/`) y la premisa de anime
   (ADR-008, Fase 10) **se mantienen**.

> Nota: la build de la WebUI está pensada para raíz de dominio. Para publicarla en
> un *project site* de GitHub Pages (`/<repo>/`) se aplicó una **adaptación mínima**
> en `web/`: `web/vite.config.ts` inyecta `<base href="VITE_BASE_PATH">` (por
> defecto `/`) y `web/index.html` usa rutas relativas para iconos y manifest. La
> vía recomendada sigue siendo servirla desde el propio servidor.

## Alternativas consideradas

### Opción A: Vendorizar Suwayomi-WebUI y extenderla (elegida)

- Pros: cliente maduro y completo desde el primer día; licencia MPL-2.0 compatible
  (copia débil por archivo); el esfuerzo propio se concentra en anime y runtimes;
  misma UX que el ecosistema Suwayomi.
- Contras: base React/MUI grande (Node >= 24, pnpm); mantenimiento de la
  divergencia al añadir anime; dependencia del contrato GraphQL del servidor.

### Opción B: UI propia (statu quo, ADR-001/002)

- Pros: control total; bundle pequeño.
- Contras: reimplementa de peor forma lo que ya existe; incompleta; el usuario la
  rechazó. Descartada.

### Opción C: Solo usar la WebUI servida por el servidor, sin vendorizar

- Pros: cero mantenimiento de cliente.
- Contras: no permite **añadir anime** ni los runtimes de AniWeb dentro de la UI.
  Se adopta como **entrega principal** (punto 2), pero no como única forma: la
  copia en `web/` es la base para las extensiones propias.

## Consecuencias

### Positivas

- Cliente completo y probado (lector, biblioteca, descargas, ajustes, i18n, temas).
- Sin CORS ni reimplementación de red: misma UX/contrato que Suwayomi.
- Licencias claras: `web/` queda MPL-2.0; el código propio de AniWeb sigue AGPL-3.0.

### Negativas / compromisos

- Se abandona el control del frontend (framework, estructura y PWA los fija el
  upstream); cualquier adición (anime) es una **divergencia a mantener**.
- Toolchain del cliente pasa a Node >= 24 + pnpm (antes Node 22 + npm).
- La adaptación de *base path* para GitHub Pages *project site* añade una pequeña
  divergencia respecto al upstream (dos archivos: `web/vite.config.ts` y
  `web/index.html`); la vía sin fricción sigue siendo servirla desde el servidor.

## Referencias

- `docs/10-servidor-suwayomi.md`, `docs/adr/ADR-008-nucleo-servidor-suwayomi.md`
- ADR-001 (reemplazada), ADR-002 (reemplazada)
- `web/` (Suwayomi-WebUI, MPL-2.0), `web/README.md`, `web/LICENSE`
- Suwayomi-WebUI: `Suwayomi/Suwayomi-WebUI` (build online
  `suwayomi-webui-preview.github.io`)
