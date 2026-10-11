<script lang="ts">
  import { onMount } from 'svelte'
  import { server } from '../lib/stores/server.svelte'
  import type { ServerInfo } from '../lib/api/types'

  let url = $state(server.url)
  let username = $state(server.username)
  let password = $state(server.password)
  let info = $state<ServerInfo | null>(null)
  let status: 'idle' | 'testing' | 'ok' | 'error' = $state('idle')
  let message = $state('')

  async function testConnection() {
    status = 'testing'
    message = ''
    info = null
    try {
      info = await server.client.getServerInfo()
      status = 'ok'
      message = `${info.name} ${info.version}`
    } catch (err) {
      status = 'error'
      message = (err as Error).message
    }
  }

  function apply() {
    server.url = url.trim()
    server.username = username
    server.password = password
    server.save()
    void testConnection()
  }

  onMount(() => {
    void testConnection()
  })
</script>

<header class="page-head">
  <h1>Ajustes</h1>
</header>

<section class="panel">
  <label for="server-url">URL del servidor Suwayomi</label>
  <input id="server-url" class="input" bind:value={url} placeholder="http://localhost:4567" autocomplete="off" />

  <div class="two-cols">
    <div>
      <label for="server-user">Usuario (opcional)</label>
      <input id="server-user" class="input" bind:value={username} autocomplete="off" />
    </div>
    <div>
      <label for="server-pass">Contrasena (opcional)</label>
      <input id="server-pass" class="input" type="password" bind:value={password} autocomplete="off" />
    </div>
  </div>

  <button class="primary" onclick={apply}>Guardar y probar conexion</button>

  {#if status === 'testing'}
    <p class="hint">Probando conexion...</p>
  {:else if status === 'ok'}
    <p class="ok">Conectado: {message}</p>
  {:else if status === 'error'}
    <p class="error">{message}</p>
  {/if}
</section>

<section class="panel">
  <h2>Como funciona</h2>
  <p class="muted">
    AniWeb es un cliente: las fuentes (extensiones) se ejecutan en el servidor Suwayomi. Instalalas desde su
    WebUI (<code>{server.url}</code>). El anime se cubre en los runtimes fallback (JS/Dart y WASM), aun en
    desarrollo.
  </p>
  <p class="muted">
    Sin servidor a mano puedes usar el mock de desarrollo: <code>node server/mock/mock-server.mjs</code> en
    <code>http://localhost:4567</code>.
  </p>
</section>
