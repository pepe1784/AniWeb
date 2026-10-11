import { afterEach, describe, expect, it, vi } from 'vitest'
import { SuwayomiClient, SuwayomiError } from './suwayomi'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('SuwayomiClient', () => {
  it('normaliza la base y construye URLs de imagen', () => {
    const client = new SuwayomiClient({ baseUrl: 'http://localhost:4567/' })
    expect(client.baseUrl).toBe('http://localhost:4567')
    expect(client.pageUrl(3, 2, 0)).toBe('http://localhost:4567/api/v1/manga/3/chapter/2/page/0')
    expect(client.thumbnailUrl({ id: 9, thumbnailUrl: null })).toBe(
      'http://localhost:4567/api/v1/manga/9/thumbnail',
    )
    expect(client.thumbnailUrl({ id: 9, thumbnailUrl: '/x.png' })).toBe('http://localhost:4567/x.png')
  })

  it('lista fuentes con GET', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: '1', name: 'Fuente' }]))
    vi.stubGlobal('fetch', fetchMock)
    const client = new SuwayomiClient({ baseUrl: 'http://s' })

    const sources = await client.listSources()

    expect(sources).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://s/api/v1/source/list',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('codifica el termino de busqueda y la pagina', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ mangaList: [], hasNextPage: false }))
    vi.stubGlobal('fetch', fetchMock)
    const client = new SuwayomiClient({ baseUrl: 'http://s' })

    await client.search('42', 'one piece', 2)

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://s/api/v1/source/42/search?searchTerm=one+piece&pageNum=2',
    )
  })

  it('mapea 424 a un error de fuente', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 424 })))
    const client = new SuwayomiClient({ baseUrl: 'http://s' })
    await expect(client.listSources()).rejects.toMatchObject({ name: 'SuwayomiError', status: 424 })
  })

  it('marca error de conexion con status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))
    const client = new SuwayomiClient({ baseUrl: 'http://s' })
    const error = await client.listSources().catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(SuwayomiError)
    expect((error as SuwayomiError).status).toBe(0)
  })

  it('anade a biblioteca con GET y envia credenciales', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const client = new SuwayomiClient({ baseUrl: 'http://s', username: 'u', password: 'p' })
    await client.addToLibrary(7)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://s/api/v1/manga/7/library')
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa('u:p')}`)
  })
})
