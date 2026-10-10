import test from "node:test";
import assert from "node:assert/strict";
import { createLoggingHost } from "../src/logging-host.mjs";

test("logging entrega eventos al consumidor", () => {
  const events = [];
  const log = createLoggingHost((e) => events.push(e));
  log.log("info", "hola");
  log.log("error", "fallo");
  assert.deepEqual(events, [
    { level: "info", message: "hola" },
    { level: "error", message: "fallo" },
  ]);
});

test("logging normaliza niveles desconocidos a info", () => {
  const events = [];
  const log = createLoggingHost((e) => events.push(e));
  log.log("fatal", "x");
  assert.equal(events[0].level, "info");
});
