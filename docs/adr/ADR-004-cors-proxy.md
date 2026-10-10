# ADR-004: Diseño del proxy CORS

- Estado: Aceptada
- Fecha: 2026-10-09
- Fase: 2
- Decisores: equipo AniWeb

## Contexto

Sin APK, `fetch()` a los dominios de las fuentes falla por CORS (ver sección 3 de la viabilidad). El proyecto no tiene backend propio con lógica, así que el proxy debe ser un componente **mínimo, configurable y opcional**, con el menor privilegio posible. Debe soportar video (Range) y cabeceras personalizadas (Referer/Origin).

## Decisión

Entregar un **proxy CORS stateless** en dos implementaciones equivalentes: **(1) Cloudflare Worker** (ruta principal, botón de despliegue) y **(2) contenedor Docker** (opción del compose). El proxy:

1. Recibe `{ url, method, headers }`.
2. Valida el host destino contra una **lista de dominios permitidos** declarada por el manifiesto de la extensión.
3. Responde con cabeceras CORS (`Access-Control-Allow-Origin: *` o espejo del Origin) y maneja preflight `OPTIONS`.
4. Soporta **Range** (passthrough de `Range`/`Accept-Ranges` y código 206) para video.
5. Permite cabeceras personalizadas limitadas (`Referer`, `Origin`, `User-Agent`) con validación.
6. Aplica **límites** (tamaño de respuesta, tiempo, nº de peticiones) y rechaza dominios no permitidos.

La app expone un ajuste "URL del proxy" (vacío = sin proxy).

## Alternativas consideradas

### Opción A: Cloudflare Worker (principal)

- Pros: gratuito y generoso; HTTPS y CORS automáticos; despliegue con un botón; sin servidor que mantener; ideal para el usuario final.
- Contras: el tráfico pasa por Cloudflare (tercero) si no se despliega en la propia cuenta; límites por plan; requiere cuenta.

### Opción B: Contenedor Docker (autoalojado)

- Pros: control total; privacidad máxima; se integra en el mismo `docker-compose.yml`.
- Contras: requiere un servidor y HTTPS propio (Caddy/Cloudflare Tunnel); más mantenimiento.

### Opción C: Extensión de navegador como proxy local

- Pros: sin servidor; usa las sesiones/cookies del navegador; útil en escritorio.
- Contras: solo escritorio; depende de instalar una extensión; no sirve en móvil.

## Consecuencias

### Positivas

- La app funciona sin proxy para fuentes con CORS abierto y con proxy para el resto.
- Privacidad: se recomienda desplegar el proxy en la propia cuenta (el proxy ve el tráfico).

### Negativas / compromisos

- La lista de dominios permitidos viaja desde el cliente; en proxies compartidos se recomienda un **token de autenticación**. En el modo "proxy propio" no es imprescindible.
- El proxy es un punto extra de latencia y de fallo potencial.
- Se debe advertir al usuario de que añadir repos de terceros es bajo su responsabilidad.

## Referencias

- `docs/01-viabilidad-navegador-pwa.md` (sección 3)
- Fase 7 (proxy) del roadmap
