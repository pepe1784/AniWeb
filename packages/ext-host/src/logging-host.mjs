// Host `logging` del runtime de extensiones.
//
// La interface WIT `log(level, message)` no devuelve nada. Los eventos se
// entregan a un consumidor inyectable (la consola de la extension en la UI),
// nunca a la consola del sitio.

const LEVELS = new Set(["trace", "debug", "info", "warn", "error"]);

export function createLoggingHost(sink = () => {}) {
  return {
    log(level, message) {
      sink({ level: LEVELS.has(level) ? level : "info", message: String(message) });
    },
  };
}
