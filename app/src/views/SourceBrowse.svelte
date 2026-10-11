<script lang="ts">
  import { server } from '../lib/stores/server.svelte'
  import { go } from '../lib/router.svelte'
  import MangaCard from '../components/MangaCard.svelte'
  import type { Manga, PagedMangaList, Source } from '../lib/api/types'

  type Tab = 'popular' | 'latest' | 'search'

  let { sourceId }: { sourceId: string } = $props()

  let source = $state<Source | null>(null)
  let items = $state<Manga[]>([])
  let tab: Tab = $state('popular')
  let term = $state('')
  let page = $state(0)
  let hasNext = $state(false)
  let loading = $state(false)
  let error = $state('')
  let lastQuery = $state('')

  $effect(() => {
    const id = sourceId
    void initialize(id)
  })

  async function fetchPage(id: string, which: Tab, targetPage: number, query: string): Promise<PagedMangaList> {
    const client = server.client
    if (which === 'search') return client.search(id, query, targetPage)
    if (which === 'latest') return client.getLatest(id, targetPage)
    return client.getPopular(id, targetPage)
  }

  async function initialize(id: string) {
    source = null
    items = []
    page = 0
    hasNext = false
    error = ''
    tab = 'popular'
    term = ''
    loading = true
    try {
      const client = server.client
      source = await client.getSource(id).catch(() => null)
      const result = await fetchPage(id, 'popular', 0, '')
      items = result.mangaList
      hasNext = result.hasNextPage
    } catch (err) {
      error = (err as Error).message
    } finally {
      loading = false
    }
  }

  async function loadMore() {
    loading = true
    error = ''
    try {
      const nextPage = page + 1
      const query = tab === 'search' ? lastQuery : ''
      const result = await fetchPage(sourceId, tab, nextPage, query)
      items = [...items, ...result.mangaList]
      hasNext = result.hasNextPage
      page = nextPage
    } catch (err) {
      error = (err as Error).message
    } finally {
      loading = false
    }
  }

  async function selectTab(next: 'popular' | 'latest' | 'search') {
    tab = next
    items = []
    page = 0
    hasNext = false
    error = ''
    if (next === 'search') {
      if (term.trim()) await runSearch()
      return
    }
    loading = true
    try {
      const result = await fetchPage(sourceId, next, 0, '')
      items = result.mangaList
      hasNext = result.hasNextPage
    } catch (err) {
      error = (err as Error).message
    } finally {
      loading = false
    }
  }

  async function runSearch() {
    const query = term.trim()
    if (!query) return
    lastQuery = query
    items = []
    page = 0
    hasNext = false
    loading = true
    error = ''
    try {
      const result = await fetchPage(sourceId, 'search', 0, query)
      items = result.mangaList
      hasNext = result.hasNextPage
    } catch (err) {
      error = (err as Error).message
    } finally {
      loading = false
    }
  }
</script>

<header class="page-head">
  <button class="ghost" onclick={() => go('#/explore')}>Fuentes</button>
  <h1 class="ellipsis">{source?.name ?? 'Fuente'}</h1>
</header>

<div class="tabs">
  <button class:active={tab === 'popular'} onclick={() => void selectTab('popular')}>Popular</button>
  <button class:active={tab === 'latest'} onclick={() => void selectTab('latest')}>Recientes</button>
  <button class:active={tab === 'search'} onclick={() => void selectTab('search')}>Buscar</button>
</div>

{#if tab === 'search'}
  <form
    class="search-form"
    onsubmit={(event) => {
      event.preventDefault()
      void runSearch()
    }}
  >
    <input class="search" bind:value={term} placeholder="Titulo..." autocomplete="off" />
    <button class="primary" type="submit">Buscar</button>
  </form>
{/if}

{#if loading && items.length === 0}
  <p class="hint">Cargando...</p>
{:else if error}
  <p class="error">{error}</p>
{:else if items.length === 0}
  <p class="hint">{tab === 'search' ? 'Escribe un titulo y pulsa Buscar.' : 'Sin resultados.'}</p>
{:else}
  <div class="grid">
    {#each items as manga (manga.id)}
      <MangaCard {manga} onSelect={() => go(`#/manga/${manga.id}`)} />
    {/each}
  </div>
  {#if hasNext}
    <div class="more">
      <button class="ghost" disabled={loading} onclick={() => void loadMore()}>
        {loading ? 'Cargando...' : 'Cargar mas'}
      </button>
    </div>
  {/if}
{/if}
