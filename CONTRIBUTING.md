# Contribuir a AniWeb

## Flujo de trabajo

- El proyecto avanza **por fases** (ver `docs/00-roadmap.md`). No se inicia una fase sin cerrar y confirmar la anterior.
- Toda decisión de arquitectura se registra como ADR en `docs/adr/` (formato en `0000-template.md`).

## Commits

- **Conventional Commits**, mensajes en inglés: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `perf:`, `build(ci):`.
- **Commits pequeños**: un cambio lógico por commit.
- Scope por área: `web`, `server`, `ext-api`, `ext-host`, `ext-loader`, `ext-sdk`, `proxy`, `infra`, `ci`, `docs`.
- Cuerpo opcional explicando el porqué cuando no sea obvio.

## Estilo

- **Sin emojis** en archivos (código, docs, README) ni en mensajes de git. Usar texto plano.
- TypeScript estricto; sin `any` injustificado. Formato con Prettier, lint con ESLint.
- Nombres de API/código en inglés; documentación en español o inglés, una sola lengua por documento.

## Licencia

Al contribuir aceptas que tu aporte se distribuya bajo AGPL-3.0 (ver `LICENSE`).
