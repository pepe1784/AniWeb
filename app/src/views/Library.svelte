<script lang="ts">
  import { server } from '../lib/stores/server.svelte'
  import { go } from '../lib/router.svelte'
  import MangaCard from '../components/MangaCard.svelte'
  import type { Manga } from '../lib/api/types'

  let items = $state<Manga[]>([])
  let loading = $state(true)
  let error = $state('')

  $effect(() => {
    void load()
  })

  async function load() {
    loading = true
    error = ''
    try {
      items = await server.client.getDefaultCategoryManga()
    } catch (err) {
      error = (err as Error).message
    } finally {
      loading = false
    }
  }
</script>

<header class="page-head">
  <h1>Biblioteca</h1>
  <button class="ghost" onclick={() => void load()}>Recargar</button>
</header>

{#if loading}
  <p class="hint">Cargando biblioteca...</p>
{:else if error}
  <p class="error">{error}</p>
  <p class="hint">Revisa la URL del servidor en Ajustes.</p>
{:else if items.length === 0}
  <p class="hint">La biblioteca esta vacia. Anade manga desde Explorar o desde la WebUI de Suwayomi.</p>
{:else}
  <div class="grid">
    {#each items as manga (manga.id)}
      <MangaCard {manga} onSelect={() => go(`#/manga/${manga.id}`)} />
    {/each}
  </div>
{/if}
