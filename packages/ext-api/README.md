# @aniweb/ext-api

Contrato WIT del runtime de extensiones de AniWeb y bindings TypeScript generados para el host.

Las extensiones son componentes WebAssembly compilados desde Rust (o cualquier idioma que emita componentes WASM) contra la interface WIT de esta carpeta. El host de la PWA las ejecuta en Web Workers aislados con host functions restringidas (ver `docs/02-arquitectura.md` y `docs/04-wit-extensiones.md`).

## Estructura

| Ruta | Contenido |
| --- | --- |
| `wit/extension.wit` | Fuente de verdad del contrato (world `extension`) |
| `src/generated/` | Bindings TS generados con `jco types`; se commitean para que los consumidores no necesiten jco |

## Contrato en una linea

- **Imports** (host functions que el host debe implementar): `http`, `parsing`, `json`, `crypto`, `logging`, `storage`.
- **Export** (API que cada extension debe implementar): `extension-api` (`init`, `id`, catalogos, buscar, detalle, capitulos/episodios, paginas, fuentes de video).
- Tipos compartidos en `types`.

## Regenerar los bindings

Requisito: Node.js 20+ y npm. Instalar jco en el workspace o usar `npx`.

```sh
npm install
npm run types
```

El comando equivalente sin instalar nada:

```sh
npx --yes jco@1.37.0 types wit/extension.wit -o src/generated --world-name extension
```

Verificar que no hubo cambios si el WIT no cambio:

```sh
npm run check
```

(`check` regenera y sale con error si `src/generated/` difiere, util en CI.)

## Reglas

- **El WIT es la fuente de verdad** del contrato. Los bindings `src/generated/` son un artefacto reproducido y commiteado.
- Nunca editar `src/generated/` a mano: se regenera desde `wit/extension.wit` con `npm run types`.
- Un cambio de contrato es un cambio de WIT + bindings regenerados + ADR cuando sea irreversible.

## Notas sobre el diseno del WIT

- WIT no permite tipos recursivos: los documentos JSON/HTML no se modelan como arbol; el host conserva el arbol y la extension accede por handles (`u32`) y paths de texto (`json`), o selectores CSS (`parsing`).
- Los casos de `variant` no pueden llamarse `string` (palabra clave): el caso de JSON string es `str`.

## Licencia

AGPL-3.0-only — ver `LICENSE` en la raiz del repositorio.