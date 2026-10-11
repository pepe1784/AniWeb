// Cliente del API REST de Suwayomi-Server (v1). Adaptador aislado para tolerar
// cambios del servidor. Ver docs/11-suwayomi-api.md.

import type { Category, Chapter, Manga, PagedMangaList, ServerInfo, Source } from './types'

export interface SuwayomiOptions {
  baseUrl: string
  username?: string
  password?: string
}

export class SuwayomiError extends Error {
  readonly status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'SuwayomiError'
    this.status = status
  }
}

type Query = Record<string, string | number | boolean | undefined>

function toBase64(value: string): string {
  return btoa(value)
}

export class SuwayomiClient {
  readonly baseUrl: string
  private readonly authHeader?: string

  constructor(options: SuwayomiOptions) {
    this.baseUrl = options.baseUrl.trim().replace(/\/+$/, '')
    if (options.username) {
      this.authHeader = `Basic ${toBase64(`${options.username}:${options.password ?? ''}`)}`
    }
  }

  /** Convierte una ruta relativa del servidor en URL absoluta. */
  absolute(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
    const separator = pathOrUrl.startsWith('/') ? '' : '/'
    return `${this.baseUrl}${separator}${pathOrUrl}`
  }

  thumbnailUrl(manga: Pick<Manga, 'id' | 'thumbnailUrl'>): string {
    return this.absolute(manga.thumbnailUrl ?? `/api/v1/manga/${manga.id}/thumbnail`)
  }

  sourceIconUrl(source: Pick<Source, 'iconUrl'>): string {
    return this.absolute(source.iconUrl)
  }

  /** URL de una pagina de capitulo (imagen). `page` base 0. */
  pageUrl(mangaId: number, chapterIndex: number, page: number): string {
    return this.absolute(`/api/v1/manga/${mangaId}/chapter/${chapterIndex}/page/${page}`)
  }

  getServerInfo(): Promise<ServerInfo> {
    return this.get('/api/v1/settings/about')
  }

  listSources(): Promise<Source[]> {
    return this.get('/api/v1/source/list')
  }

  getSource(sourceId: string): Promise<Source> {
    return this.get(`/api/v1/source/${encodeURIComponent(sourceId)}`)
  }

  getPopular(sourceId: string, page = 0): Promise<PagedMangaList> {
    return this.get(`/api/v1/source/${encodeURIComponent(sourceId)}/popular/${page}`)
  }

  getLatest(sourceId: string, page = 0): Promise<PagedMangaList> {
    return this.get(`/api/v1/source/${encodeURIComponent(sourceId)}/latest/${page}`)
  }

  search(sourceId: string, term: string, page = 1): Promise<PagedMangaList> {
    return this.get(`/api/v1/source/${encodeURIComponent(sourceId)}/search`, {
      searchTerm: term,
      pageNum: page,
    })
  }

  getManga(mangaId: number, onlineFetch = false): Promise<Manga> {
    return this.get(`/api/v1/manga/${mangaId}`, { onlineFetch })
  }

  getMangaFull(mangaId: number, onlineFetch = false): Promise<Manga> {
    return this.get(`/api/v1/manga/${mangaId}/full`, { onlineFetch })
  }

  getChapters(mangaId: number, onlineFetch = false): Promise<Chapter[]> {
    return this.get(`/api/v1/manga/${mangaId}/chapters`, { onlineFetch })
  }

  getChapter(mangaId: number, chapterIndex: number): Promise<Chapter> {
    return this.get(`/api/v1/manga/${mangaId}/chapter/${chapterIndex}`)
  }

  getCategories(): Promise<Category[]> {
    return this.get('/api/v1/category')
  }

  getCategoryManga(categoryId: number): Promise<Manga[]> {
    return this.get(`/api/v1/category/${categoryId}`)
  }

  /** Manga de la biblioteca (categoria por defecto). */
  async getDefaultCategoryManga(): Promise<Manga[]> {
    const categories = await this.getCategories()
    const fallback = categories.find((category) => category.isDefaultCategory) ?? categories[0]
    if (!fallback) return []
    return this.getCategoryManga(fallback.id)
  }

  addToLibrary(mangaId: number): Promise<void> {
    return this.send('GET', `/api/v1/manga/${mangaId}/library`)
  }

  removeFromLibrary(mangaId: number): Promise<void> {
    return this.send('DELETE', `/api/v1/manga/${mangaId}/library`)
  }

  setChapterRead(mangaId: number, chapterIndex: number, read: boolean): Promise<void> {
    return this.send('PATCH', `/api/v1/manga/${mangaId}/chapter/${chapterIndex}`, {
      read: String(read),
    })
  }

  private buildUrl(path: string, query?: Query): string {
    const url = new URL(this.absolute(path))
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value))
      }
    }
    return url.toString()
  }

  private headers(hasBody: boolean, form: boolean): Record<string, string> {
    const headers: Record<string, string> = {}
    if (hasBody) headers['Content-Type'] = form ? 'application/x-www-form-urlencoded' : 'application/json'
    if (this.authHeader) headers.Authorization = this.authHeader
    return headers
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    let response: Response
    try {
      response = await fetch(this.absolute(path), init)
    } catch (error) {
      throw new SuwayomiError(`No se pudo conectar con ${this.baseUrl}: ${(error as Error).message}`)
    }
    if (!response.ok) {
      const detail = response.status === 424 ? 'fallo de la fuente' : response.statusText
      throw new SuwayomiError(`HTTP ${response.status} (${detail})`, response.status)
    }
    return response
  }

  private async get<T>(path: string, query?: Query): Promise<T> {
    const url = this.buildUrl(path, query)
    const response = await this.request(url, { method: 'GET', headers: this.headers(false, false) })
    return (await response.json()) as T
  }

  private async send(method: string, path: string, form?: Record<string, string>): Promise<void> {
    const body = form ? new URLSearchParams(form).toString() : undefined
    await this.request(path, {
      method,
      headers: this.headers(body !== undefined, true),
      body,
    })
  }
}
