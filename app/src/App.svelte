<script lang="ts">
  import { go, router } from './lib/router.svelte'
  import Library from './views/Library.svelte'
  import Explore from './views/Explore.svelte'
  import SourceBrowse from './views/SourceBrowse.svelte'
  import MangaDetail from './views/MangaDetail.svelte'
  import Reader from './views/Reader.svelte'
  import Settings from './views/Settings.svelte'

  const route = $derived(router.current)
</script>

<div class="app">
  <main class="content">
    {#if route.name === 'library'}
      <Library />
    {:else if route.name === 'explore'}
      <Explore />
    {:else if route.name === 'source'}
      <SourceBrowse sourceId={route.sourceId ?? ''} />
    {:else if route.name === 'manga'}
      <MangaDetail mangaId={route.mangaId ?? 0} />
    {:else if route.name === 'reader'}
      <Reader mangaId={route.mangaId ?? 0} chapterIndex={route.chapterIndex ?? 0} />
    {:else if route.name === 'settings'}
      <Settings />
    {/if}
  </main>

  <nav class="tabbar">
    <button class:active={route.name === 'library'} onclick={() => go('#/library')}>
      <span class="glyph">B</span><span>Biblioteca</span>
    </button>
    <button
      class:active={route.name === 'explore' || route.name === 'source'}
      onclick={() => go('#/explore')}
    >
      <span class="glyph">E</span><span>Explorar</span>
    </button>
    <button class:active={route.name === 'settings'} onclick={() => go('#/settings')}>
      <span class="glyph">A</span><span>Ajustes</span>
    </button>
  </nav>
</div>
