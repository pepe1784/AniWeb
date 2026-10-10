// Puente WIT `logging`. Entrega los eventos a `globalThis.__ANIWEB_LOGS__`.

import { createLoggingHost } from "../logging-host.mjs";

const host = createLoggingHost((event) => {
  const logs = globalThis.__ANIWEB_LOGS__;
  if (logs) logs.push(event);
});

export const log = (level, message) => host.log(level, message);
