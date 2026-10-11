<script lang="ts">
  import { server } from '../lib/stores/server.svelte'
  import { go } from '../lib/router.svelte'
  import type { Chapter } from '../lib/api/types'

  let { mangaId, chapterIndex }: { mangaId: number; chapterIndex: number } = $props()

  let chapter = $state<Chapter | null>(null)
  let chapters = $state<Chapter[]>([])
  let loading = $state(true)
  let error = $state('')

  const pages = $derived(
    chapter && chapter.pageCount > 0 ? Array.from({ length: chapter.pageCount }, (_, i) => i) : [],
  )
  const position = $derived(chapters.findIndex((item) => item.index === chapterIndex))
  const older = $derived(position >= 0 ? chapters[position + 1] : undefined)
  const newer = $derived(position > 0 ? chapters[position - 1] : undefined)

  $effect(() => {
    const id = mangaId
    const index = chapterIndex
    void (async () => {
      loading = true
      error = ''
      chapter = null
      chapters = []
      try {
        const client = server.client
        chapter = await client.getChapter(id, index)
        chapters = await client.getChapters(id)
        void client.setChapterRead(id, index, true).catch(() => undefined)
      } catch (err) {
        error = (err as Error).message
      } finally {
        loading = false
      }
    })()
  })
</script>

<header class="page-head">
  <button class="ghost" onclick={() => go(`#/manga/${mangaId}`)}>Ficha</button>
  <span class="reader-title ellipsis">{chapter?.name ?? `Capitulo ${chapterIndex}`}</span>
  <span class="muted">{chapter ? `${Math.max(chapter.pageCount, 0)} pag.` : ''}</span>
</header>

{#if loading}
  <p class="hint">Cargando capitulo...</p>
{:else if error}
  <p class="error">{error}</p>
{:else if chapter}
  <div class="reader-nav">
    <button class="ghost" disabled={!older} onclick={() => older && go(`#/manga/${mangaId}/chapter/${older.index}`)}>
      Anterior
    </button>
    <button class="ghost" disabled={!newer} onclick={() => newer && go(`#/manga/${mangaId}/chapter/${newer.index}`)}>
      Siguiente
    </button>
  </div>

  {#if pages.length === 0}
    <p class="hint">El servidor no devolvio paginas para este capitulo.</p>
  {:else}
    <div class="pages">
      {#each pages as page (page)}
        <img
          class="page"
          src={server.client.pageUrl(mangaId, chapterIndex, page)}
          alt={`Pagina ${page + 1}`}
          loading="lazy"
        />
      {/each}
    </div>
  {/if}

  <div class="reader-nav">
    <button class="ghost" disabled={!older} onclick={() => older && go(`#/manga/${mangaId}/chapter/${older.index}`)}>
      Anterior
    </button>
    <button class="ghost" disabled={!newer} onclick={() => newer && go(`#/manga/${mangaId}/chapter/${newer.index}`)}>
      Siguiente
    </button>
  </div>
{/if}
