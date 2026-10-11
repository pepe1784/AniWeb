# app/ - PWA de AniWeb

Cliente fin en **Svelte 5 + Vite** (ADR-001) que consume la **API REST de
Suwayomi-Server** (`docs/11-suwayomi-api.md`). La PWA unifica manga (servidor) y
anime (runtimes fallback, en desarrollo) y aporta la interfaz propia.

- Vistas: Biblioteca, Explorar (fuentes), fuente (Popular/Recientes/Buscar),
  ficha de manga, lector, Ajustes.
- Enrutado por hash (`#/library`, `#/explore`, `#/source/{id}`,
  `#/manga/{id}`, `#/manga/{id}/chapter/{index}`, `#/settings`).
- Cliente de API en `src/lib/api/suwayomi.ts` (adaptador aislado).
- PWA con `vite-plugin-pwa` en modo `injectManifest` (ADR-002); SW en `src/sw.ts`.

## Desarrollo

```sh
npm install

# Opcion A: sin servidor real (mock con la misma forma de API)
node ../server/mock/mock-server.mjs      # http://localhost:4567
npm run dev                              # http://localhost:5173

# Opcion B: servidor real (Docker)
docker compose -f ../server/docker-compose.yml up -d   # http://localhost:4567
npm run dev
```

En **Ajustes** se configura la URL del servidor (por defecto
`http://localhost:4567`).

## Scripts

- `npm run dev` - servidor de desarrollo Vite.
- `npm run build` - build de produccion a `dist/`.
- `npm run preview` - sirve el build.
- `npm test` - pruebas unitarias (Vitest) del cliente de API.
- `npm run check` - `svelte-check`.
- `npm run typecheck` - `tsc --noEmit`.

## Verificacion de la Fase 9

Criterio: leer un capitulo completo desde la PWA. En este entorno no hay
Docker/JRE para el servidor real, asi que se verifica con el **mock** (misma forma
de API): Explorar -> fuente -> Popular/Buscar -> ficha -> capitulo -> lector con
las paginas. Con el servidor real solo cambia la URL en Ajustes.
