<script lang="ts">
  import { server } from '../lib/stores/server.svelte'
  import { go } from '../lib/router.svelte'
  import type { Chapter, Manga } from '../lib/api/types'

  let { mangaId }: { mangaId: number } = $props()

  let manga = $state<Manga | null>(null)
  let chapters = $state<Chapter[]>([])
  let loading = $state(true)
  let error = $state('')
  let busy = $state(false)

  $effect(() => {
    const id = mangaId
    void (async () => {
      loading = true
      error = ''
      manga = null
      chapters = []
      try {
        const client = server.client
        manga = await client.getManga(id, true)
        chapters = await client.getChapters(id, true)
      } catch (err) {
        error = (err as Error).message
      } finally {
        loading = false
      }
    })()
  })

  async function toggleLibrary() {
    if (!manga) return
    busy = true
    try {
      if (manga.inLibrary) {
        await server.client.removeFromLibrary(manga.id)
        manga = { ...manga, inLibrary: false }
      } else {
        await server.client.addToLibrary(manga.id)
        manga = { ...manga, inLibrary: true }
      }
    } catch (err) {
      error = (err as Error).message
    } finally {
      busy = false
    }
  }
</script>

<header class="page-head">
  <button class="ghost" onclick={() => go('#/explore')}>Atras</button>
</header>

{#if loading}
  <p class="hint">Cargando ficha...</p>
{:else if error}
  <p class="error">{error}</p>
{:else if manga}
  <div class="detail">
    <div class="cover detail-cover">
      <img
        src={server.client.thumbnailUrl(manga)}
        alt={manga.title}
        onerror={(event) => ((event.currentTarget as HTMLImageElement).style.display = 'none')}
      />
    </div>
    <div class="detail-info">
      <h1>{manga.title}</h1>
      <p class="muted">{[manga.author, manga.artist].filter(Boolean).join(' / ') || 'Autor desconocido'}</p>
      <p class="muted">Estado: {manga.status ?? 'DESCONOCIDO'}</p>
      {#if manga.genre && manga.genre.length}
        <p class="muted">Generos: {manga.genre.join(', ')}</p>
      {/if}
      <div class="actions">
        <button class="primary" disabled={busy} onclick={() => void toggleLibrary()}>
          {manga.inLibrary ? 'Quitar de biblioteca' : 'Anadir a biblioteca'}
        </button>
      </div>
      {#if manga.description}
        <p class="description">{manga.description}</p>
      {/if}
    </div>
  </div>

  <h2>Capitulos ({chapters.length})</h2>
  {#if chapters.length === 0}
    <p class="hint">Sin capitulos. Revisa la fuente o pulsa Atras.</p>
  {:else}
    <ul class="chapters">
      {#each chapters as item (item.id)}
        <li>
          <button onclick={() => go(`#/manga/${mangaId}/chapter/${item.index}`)}>
            <span class:read={item.read}>{item.name}</span>
            <span class="muted">{Math.max(item.pageCount, 0)} pag.</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
{/if}
