// Servidor Suwayomi SIMULADO para desarrollo del cliente AniWeb.
//
// No es el producto: reproduce la forma de la API REST de Suwayomi-Server
// (`/api/v1/...`) con datos de ejemplo e imagenes SVG generadas al vuelo. Sirve
// para probar la PWA sin Docker ni JRE. Ver docs/11-suwayomi-api.md.
//
// Uso:  node server/mock/mock-server.mjs   (escucha en http://localhost:4567)
//       PORT=4568 node server/mock/mock-server.mjs

import { createServer } from 'node:http'

const PORT = Number(process.env.PORT ?? process.env.SUWAYOMI_PORT ?? 4567)

const SOURCE = {
  id: '2451757425215093970',
  name: 'MangaOni (mock)',
  lang: 'es',
  iconUrl: '/api/v1/extension/icon/mock',
  supportsLatest: true,
  isConfigurable: false,
  isNsfw: false,
  displayName: 'MangaOni (mock)',
  baseUrl: 'https://manga-oni.com',
}

const TITLES = [
  'Naruto',
  'One Piece',
  'Bleach',
  'Dragon Ball',
  'Fullmetal Alchemist',
  'Death Note',
  'Attack on Titan',
  'My Hero Academia',
  'Chainsaw Man',
  'Jujutsu Kaisen',
  'Demon Slayer',
  'Tokyo Ghoul',
  'Vinland Saga',
  'Monster',
  'Berserk',
  'Hunter x Hunter',
  'Fairy Tail',
  'Sword Art Online',
  'Re:Zero',
  'Spy x Family',
]

const MANGA_COUNT = 24
const library = new Set()

function mangaFor(index) {
  const id = index + 1
  const base = TITLES[index % TITLES.length]
  const title = index >= TITLES.length ? `${base} ${Math.floor(index / TITLES.length) + 1}` : base
  return {
    id,
    sourceId: SOURCE.id,
    url: `/manga/${id}`,
    title,
    thumbnailUrl: `/api/v1/manga/${id}/thumbnail`,
    thumbnailUrlLastFetched: 0,
    initialized: true,
    artist: 'Mock Artist',
    author: 'Mock Author',
    description: `Descripcion de ejemplo para "${title}". Solo para desarrollo del cliente AniWeb.`,
    genre: ['Accion', 'Aventura'],
    status: 'ONGOING',
    inLibrary: library.has(id),
    source: SOURCE,
  }
}

const MANGA = Array.from({ length: 24 }, (_, index) => mangaFor(index))

function pageCountFor(chapterIndex) {
  return 3 + (chapterIndex % 3)
}

function chaptersFor(mangaId) {
  const count = 3 + (mangaId % 5)
  const list = []
  for (let index = count; index >= 1; index -= 1) {
    list.push({
      id: mangaId * 1000 + index,
      url: `/manga/${mangaId}/chapter/${index}`,
      name: `Capitulo ${index}`,
      uploadDate: Date.now() - index * 86_400_000,
      chapterNumber: index,
      scanlator: null,
      mangaId,
      read: false,
      bookmarked: false,
      lastPageRead: 0,
      index,
      fetchedAt: Date.now(),
      realUrl: null,
      downloaded: false,
      pageCount: pageCountFor(index),
    })
  }
  return list
}

function svg(title, subtitle) {
  const safeTitle = escapeXml(title)
  const safeSubtitle = escapeXml(subtitle)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
  <rect width="800" height="1200" fill="#10131a"/>
  <rect x="24" y="24" width="752" height="1152" fill="none" stroke="#2a3140" stroke-width="4" rx="12"/>
  <text x="400" y="560" fill="#e6e8ec" font-family="sans-serif" font-size="44" font-weight="700" text-anchor="middle">${safeTitle}</text>
  <text x="400" y="630" fill="#9aa3b2" font-family="sans-serif" font-size="28" text-anchor="middle">${safeSubtitle}</text>
  <text x="400" y="1140" fill="#5b6472" font-family="sans-serif" font-size="22" text-anchor="middle">AniWeb mock server</text>
</svg>`
}

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case '"':
        return '&quot;'
      default:
        return '&apos;'
    }
  })
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  })
  response.end(payload)
}

function sendImage(response, content) {
  response.writeHead(200, {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'max-age=60',
    'Access-Control-Allow-Origin': '*',
  })
  response.end(content)
}

function notFound(response) {
  sendJson(response, 404, { error: 'Not found' })
}

function searchManga(term) {
  const query = (term ?? '').toLowerCase()
  return MANGA.filter((manga) => manga.title.toLowerCase().includes(query))
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${PORT}`)
  const path = url.pathname
  const query = url.searchParams

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    })
    response.end()
    return
  }

  if (path === '/api/v1/settings/about') {
    sendJson(response, 200, {
      name: 'AniWeb Mock Server',
      version: 'mock-1',
      revision: 'mock',
      buildType: 'Mock',
      buildTime: Date.now(),
      github: 'https://github.com/pepe1784/AniWeb',
      discord: '',
    })
    return
  }

  if (path === '/api/v1/source/list') {
    sendJson(response, 200, [SOURCE])
    return
  }

  if (path === `/api/v1/source/${SOURCE.id}`) {
    sendJson(response, 200, SOURCE)
    return
  }

  if (path === '/api/v1/extension/list') {
    sendJson(response, 200, [])
    return
  }

  let match = path.match(/^\/api\/v1\/source\/([^/]+)\/(popular|latest)\/(\d+)$/)
  if (match) {
    sendJson(response, 200, { mangaList: MANGA, hasNextPage: false })
    return
  }

  match = path.match(/^\/api\/v1\/source\/([^/]+)\/search$/)
  if (match) {
    sendJson(response, 200, { mangaList: searchManga(query.get('searchTerm')), hasNextPage: false })
    return
  }

  match = path.match(/^\/api\/v1\/manga\/(\d+)\/thumbnail$/)
  if (match) {
    const manga = MANGA[Number(match[1]) - 1]
    if (!manga) return notFound(response)
    sendImage(response, svg(manga.title, 'Portada'))
    return
  }

  match = path.match(/^\/api\/v1\/manga\/(\d+)\/chapter\/(\d+)\/page\/(\d+)$/)
  if (match) {
    const manga = MANGA[Number(match[1]) - 1]
    if (!manga) return notFound(response)
    const chapterIndex = Number(match[2])
    const page = Number(match[3])
    sendImage(response, svg(manga.title, `Capitulo ${chapterIndex} - Pagina ${page + 1} / ${pageCountFor(chapterIndex)}`))
    return
  }

  match = path.match(/^\/api\/v1\/manga\/(\d+)\/chapters$/)
  if (match) {
    sendJson(response, 200, chaptersFor(Number(match[1])))
    return
  }

  match = path.match(/^\/api\/v1\/manga\/(\d+)\/chapter\/(\d+)$/)
  if (match) {
    const chapter = chaptersFor(Number(match[1])).find((item) => item.index === Number(match[2]))
    if (!chapter) return notFound(response)
    sendJson(response, 200, chapter)
    return
  }

  match = path.match(/^\/api\/v1\/manga\/(\d+)\/library$/)
  if (match) {
    const id = Number(match[1])
    if (request.method === 'DELETE') library.delete(id)
    else library.add(id)
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*' })
    response.end()
    return
  }

  match = path.match(/^\/api\/v1\/manga\/(\d+)(?:\/full)?$/)
  if (match) {
    const manga = MANGA[Number(match[1]) - 1]
    if (!manga) return notFound(response)
    sendJson(response, 200, { ...manga, inLibrary: library.has(manga.id) })
    return
  }

  if (path === '/api/v1/category') {
    sendJson(response, 200, [
      { id: 1, order: 0, name: 'Default', default: true, isDefaultCategory: true },
    ])
    return
  }

  match = path.match(/^\/api\/v1\/category\/(\d+)$/)
  if (match) {
    sendJson(response, 200, MANGA.filter((manga) => library.has(manga.id)).map((manga) => ({ ...manga, inLibrary: true })))
    return
  }

  notFound(response)
})

server.listen(PORT, () => {
  console.log(`[aniweb-mock] Suwayomi mock en http://localhost:${PORT}`)
  console.log('[aniweb-mock] fuente: MangaOni (mock); datos de ejemplo en /api/v1/...')
})
