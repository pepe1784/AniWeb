// Formas de datos de la API REST de Suwayomi-Server (v1). Ver docs/11-suwayomi-api.md.

export interface Source {
  id: string
  name: string
  lang: string
  iconUrl: string
  supportsLatest: boolean
  isConfigurable: boolean
  isNsfw: boolean
  displayName: string
  baseUrl?: string | null
}

export interface Manga {
  id: number
  sourceId: string
  url: string
  title: string
  thumbnailUrl: string | null
  thumbnailUrlLastFetched?: number
  initialized?: boolean
  artist?: string | null
  author?: string | null
  description?: string | null
  genre?: string[]
  status?: string
  inLibrary: boolean
  source?: Source | null
}

export interface PagedMangaList {
  mangaList: Manga[]
  hasNextPage: boolean
}

export interface Chapter {
  id: number
  url: string
  name: string
  uploadDate: number
  chapterNumber: number
  scanlator?: string | null
  mangaId: number
  read: boolean
  bookmarked: boolean
  lastPageRead: number
  index: number
  fetchedAt?: number
  downloaded?: boolean
  pageCount: number
}

export interface Category {
  id: number
  order: number
  name: string
  default: boolean
  isDefaultCategory: boolean
}

export interface ServerInfo {
  name: string
  version: string
  revision: string
  buildType: string
  buildTime: number
  github: string
  discord: string
}
