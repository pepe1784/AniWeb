import { SuwayomiClient } from '../api/suwayomi'

const STORAGE_KEY = 'aniweb.server'

interface SavedServer {
  url: string
  username: string
  password: string
}

const DEFAULT_URL = 'http://localhost:4567'

function loadSaved(): SavedServer {
  if (typeof localStorage === 'undefined') return { url: DEFAULT_URL, username: '', password: '' }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { url: DEFAULT_URL, username: '', password: '' }
    const parsed = JSON.parse(raw) as Partial<SavedServer>
    return {
      url: parsed.url ?? DEFAULT_URL,
      username: parsed.username ?? '',
      password: parsed.password ?? '',
    }
  } catch {
    return { url: DEFAULT_URL, username: '', password: '' }
  }
}

const saved = loadSaved()

class ServerStore {
  url = $state(saved.url)
  username = $state(saved.username)
  password = $state(saved.password)

  get client(): SuwayomiClient {
    return new SuwayomiClient({
      baseUrl: this.url,
      username: this.username || undefined,
      password: this.password || undefined,
    })
  }

  save(): void {
    if (typeof localStorage === 'undefined') return
    const payload: SavedServer = {
      url: this.url,
      username: this.username,
      password: this.password,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }
}

export const server = new ServerStore()
