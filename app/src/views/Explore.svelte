<script lang="ts">
  import { server } from '../lib/stores/server.svelte'
  import { go } from '../lib/router.svelte'
  import type { Source } from '../lib/api/types'

  let sources = $state<Source[]>([])
  let loading = $state(true)
  let error = $state('')
  let filter = $state('')

  const visible = $derived(
    sources.filter((source) => {
      const haystack = `${source.name} ${source.lang}`.toLowerCase()
      return haystack.includes(filter.trim().toLowerCase())
    }),
  )

  $effect(() => {
    void load()
  })

  async function load() {
    loading = true
    error = ''
    try {
      sources = await server.client.listSources()
    } catch (err) {
      error = (err as Error).message
    } finally {
      loading = false
    }
  }
</script>

<header class="page-head">
  <h1>Explorar</h1>
  <button class="ghost" onclick={() => void load()}>Recargar</button>
</header>

<input class="search" placeholder="Filtrar fuentes" bind:value={filter} />

{#if loading}
  <p class="hint">Cargando fuentes...</p>
{:else if error}
  <p class="error">{error}</p>
  <p class="hint">Revisa la URL del servidor en Ajustes.</p>
{:else if visible.length === 0}
  <p class="hint">No hay fuentes. Instala extensiones en la WebUI de Suwayomi.</p>
{:else}
  <ul class="list">
    {#each visible as source (source.id)}
      <li>
        <button class="row" onclick={() => go(`#/source/${encodeURIComponent(source.id)}`)}>
          <span class="lang">{source.lang}</span>
          <span class="row-name">{source.name}</span>
        </button>
      </li>
    {/each}
  </ul>
{/if}
