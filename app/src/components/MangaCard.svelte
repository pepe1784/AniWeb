<script lang="ts">
  import { server } from '../lib/stores/server.svelte'
  import type { Manga } from '../lib/api/types'

  let { manga, onSelect }: { manga: Manga; onSelect?: () => void } = $props()
  let failed = $state(false)
</script>

<button class="card" onclick={() => onSelect?.()}>
  <div class="cover">
    {#if failed}
      <span class="cover-fallback">{manga.title.slice(0, 1).toUpperCase()}</span>
    {:else}
      <img
        src={server.client.thumbnailUrl(manga)}
        alt={manga.title}
        loading="lazy"
        onerror={() => (failed = true)}
      />
    {/if}
  </div>
  <span class="card-title">{manga.title}</span>
</button>
