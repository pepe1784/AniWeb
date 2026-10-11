# 11 · API de Suwayomi-Server que consume el cliente

> Referencia de la parte de la API REST/GraphQL de **Suwayomi-Server** (upstream,
> MPL-2.0) que usa la PWA. Verificada contra `master` (`d4f88a3`) y el estable
> `v2.4.2366`: las rutas de lector son identicas.
> Fuente: codigo del servidor
> (`server/src/main/kotlin/suwayomi/tachidesk/...`). Decimos "Suwayomi" por
> brevedad; el proyecto antes se llamaba Tachidesk.

## 0. Base y convenciones

- Base REST: `<serverUrl>/api/v1`.
- GraphQL: `POST <serverUrl>/api/graphql` (**no** esta bajo `/api/v1`).
- Sin envoltorio generico: muchos endpoints devuelven arrays desnudos o wrappers
  pequenos (`PagedMangaList`, `PaginatedList`).
- Nombres JSON en camelCase; los enum se serializan por nombre (`status:
  "ONGOING"`).
- `sourceId` es **String** en el JSON pero **numerico** en la ruta.
- Rutas exactas, sin barra final implicita. Bajo `/api` una ruta no coincidente
  responde 404.
- Auth por defecto: **ninguna** (`authMode=NONE`). Con `AUTH_MODE=basic_auth`
  todas las peticiones (incluidas imagenes y WebSocket) exigen HTTP Basic, y los
  endpoints de imagen **no** aceptan token propio.
- Si el host de una fuente falla, el servidor responde **424** (no 500).

## 1. Endpoints usados por la PWA

### Fuentes

| Metodo | Ruta | Query | Respuesta |
| --- | --- | --- | --- |
| GET | `/api/v1/source/list` | - | `Source[]` |
| GET | `/api/v1/source/{sourceId}` | - | `Source` |
| GET | `/api/v1/source/{sourceId}/popular/{pageNum}` | - | `PagedMangaList` |
| GET | `/api/v1/source/{sourceId}/latest/{pageNum}` | - | `PagedMangaList` |
| GET | `/api/v1/source/{sourceId}/search` | `searchTerm`, `pageNum` | `PagedMangaList` |

`popular`/`latest` pasan `pageNum` tal cual a la extension (indice base 0 en
Tachiyomi). `search` declara `pageNum` por defecto 1, pero tambien lo pasa tal
cual; `hasNextPage` indica si hay mas.

### Manga (detalle sin anadir a biblioteca)

Al listar/buscar, el servidor persiste los mangas y devuelve un `id` de base de
datos. Con ese `id` se consultan los detalles; consultarlos **no** anade a
biblioteca.

| Metodo | Ruta | Query | Respuesta |
| --- | --- | --- | --- |
| GET | `/api/v1/manga/{mangaId}` | `onlineFetch` | `Manga` |
| GET | `/api/v1/manga/{mangaId}/full` | `onlineFetch` | `Manga` (completo) |
| GET | `/api/v1/manga/{mangaId}/thumbnail` | - | imagen |
| GET | `/api/v1/manga/{mangaId}/library` | - | 200 (anade a biblioteca) |
| DELETE | `/api/v1/manga/{mangaId}/library` | - | 200 (quita) |
| GET | `/api/v1/manga/{mangaId}/chapters` | `onlineFetch` | `Chapter[]` (index desc) |
| GET | `/api/v1/manga/{mangaId}/chapter/{chapterIndex}` | - | `Chapter` (resuelve `pageCount`) |
| PATCH | `/api/v1/manga/{mangaId}/chapter/{chapterIndex}` | form `read` | 200 |

### Paginas (imagenes)

No hay JSON con la lista de paginas en v1. El cliente construye las URLs a partir
de `Chapter.pageCount`:

```
GET /api/v1/manga/{mangaId}/chapter/{chapterIndex}/page/{index}
```

- `chapterIndex` = `Chapter.index` (base 1).
- `index` de pagina = base 0; rango `0 .. pageCount-1`.
- `pageCount` puede ser `-1` hasta resolverse; pedir el capitulo una vez suele
  resolverlo.
- Query opcional `updateProgress=true` actualiza el progreso al servir la imagen.

### Biblioteca (categoria por defecto)

No hay `GET /manga/list`. La biblioteca es la categoria con
`isDefaultCategory: true`:

| Metodo | Ruta | Respuesta |
| --- | --- | --- |
| GET | `/api/v1/category` | `Category[]` |
| GET | `/api/v1/category/{categoryId}` | `Manga[]` |

### Extras

| Metodo | Ruta | Respuesta |
| --- | --- | --- |
| GET | `/api/v1/settings/about` | `{ name, version, revision, buildType, buildTime, github, discord }` |
| GET | `/api/v1/extension/list` | `Extension[]` |

No hay busqueda global en v1 (`all/search` esta comentado); el cliente busca por
fuente.

## 2. Formas de datos (campos usados)

`Source`

```
{ id: string, name: string, lang: string, iconUrl: string,
  supportsLatest: boolean, isConfigurable: boolean, isNsfw: boolean,
  displayName: string, baseUrl?: string | null }
```

`PagedMangaList`

```
{ mangaList: Manga[], hasNextPage: boolean }
```

`Manga`

```
{ id: number, sourceId: string, url: string, title: string,
  thumbnailUrl: string | null, initialized: boolean,
  artist?: string | null, author?: string | null, description?: string | null,
  genre: string[], status: string, inLibrary: boolean,
  source?: Source | null }
```

`thumbnailUrl` es **relativo** (`/api/v1/manga/{id}/thumbnail`); hay que
anteponer la base del servidor.

`Chapter`

```
{ id: number, url: string, name: string, uploadDate: number,
  chapterNumber: number, scanlator?: string | null, mangaId: number,
  read: boolean, bookmarked: boolean, lastPageRead: number,
  index: number, fetchedAt: number, downloaded: boolean, pageCount: number }
```

`Category`

```
{ id: number, order: number, name: string, default: boolean,
  isDefaultCategory: boolean, ... }
```

## 3. Gotchas

1. GraphQL es `/api/graphql`, no `/api/v1/graphql`.
2. Sin barra final; rutas exactas.
3. Arrays desnudos, sin `{ data: ... }`.
4. `sourceId` String en JSON, numerico en ruta.
5. `chapterIndex` (base 1) vs pagina `index` (base 0).
6. Sin JSON de paginas: construir URLs desde `pageCount`.
7. `thumbnailUrl`/`iconUrl` relativos.
8. `Manga` de `retrieve` puede no traer `unreadCount`/`chapterCount`; se rellenan
   en la ruta de categoria.
9. 424 = fallo del host de la fuente (no del servidor).
10. Con basic auth, las imagenes tambien requieren credenciales (no hay token en
    la URL).

## 4. Como lo consume AniWeb

- `app/src/lib/api/suwayomi.ts` implementa un `SuwayomiClient` con estos
  endpoints y un adaptador aislado, para tolerar cambios de la API.
- La base se configura en **Ajustes** (por defecto `http://localhost:4567`).
- `server/mock/mock-server.mjs` reproduce estas formas para desarrollo sin
  Docker/JRE.

## Referencias

- `docs/10-servidor-suwayomi.md`, `docs/adr/ADR-008-nucleo-servidor-suwayomi.md`
- Codigo del servidor: `server/.../manga/controller/{Source,Manga,Category}Controller.kt`
- `docs/adr/ADR-004-cors-proxy.md` (proxy, solo para los runtimes de cliente)
