export type RouteName = 'library' | 'explore' | 'source' | 'manga' | 'reader' | 'settings'

export interface Route {
  name: RouteName
  sourceId?: string
  mangaId?: number
  chapterIndex?: number
}

function parse(hash: string): Route {
  const clean = hash.replace(/^#/, '')
  const parts = clean.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
  switch (parts[0]) {
    case 'explore':
      return { name: 'explore' }
    case 'settings':
      return { name: 'settings' }
    case 'source':
      return { name: 'source', sourceId: parts[1] ?? '' }
    case 'manga':
      if (parts[2] === 'chapter') {
        return { name: 'reader', mangaId: Number(parts[1]), chapterIndex: Number(parts[3]) }
      }
      return { name: 'manga', mangaId: Number(parts[1]) }
    default:
      return { name: 'library' }
  }
}

class Router {
  current = $state<Route>({ name: 'library' })

  constructor() {
    if (typeof window !== 'undefined') {
      this.current = parse(window.location.hash)
      window.addEventListener('hashchange', () => {
        this.current = parse(window.location.hash)
      })
    }
  }
}

export const router = new Router()

export function go(hash: string): void {
  if (typeof window !== 'undefined') window.location.hash = hash
}
