// Entry del Worker de extensiones (navegador, modulo).
//
// Protocolo (mensajes del hilo principal):
//   { type: "instantiate", entryUrl, settings, hostConfig, limits }
//        -> { type: "ready", id } | { type: "error", reason }
//   { type: "call", name, args }
//        -> { type: "result", ok, truncated } | { type: "result", err }
//
// El componente se importa de forma DINAMICA despues de fijar
// globalThis.__ANIWEB_HOST_CONFIG__ (los puentes de packages/ext-host/
// src/wit-imports lo leen). jco auto-instancia el componente en el top-level
// await de ese import, asi que no hay forma de fi jar la configuracion antes
// de evaluarlo si se importara estaticamente.

import { handleMessage } from "./dispatch.mjs";

let api = null;
let limits = {};

async function instantiate(message) {
  try {
    globalThis.__ANIWEB_HOST_CONFIG__ = message.hostConfig || {};
    globalThis.__ANIWEB_LOGS__ = [];
    limits = message.limits || {};
    const mod = await import(/* @vite-ignore */ message.entryUrl);
    api = mod.extensionApi;
    if (typeof api.init !== "function" || typeof api.id !== "function") {
      throw new Error("el componente no expone init/id");
    }
    try {
      api.init(typeof message.settings === "string" ? message.settings : "{}");
    } catch (error) {
      throw new Error(`init fallo: ${error && error.message ? error.message : String(error)}`);
    }
    const id = api.id();
    if (message.hostConfig && message.hostConfig.id && id !== message.hostConfig.id) {
      throw new Error(
        `el id del componente (${id}) no coincide con el manifest instalado (${message.hostConfig.id})`,
      );
    }
    self.postMessage({ type: "ready", id });
  } catch (error) {
    self.postMessage({ type: "error", reason: error && error.message ? error.message : String(error) });
    self.close();
  }
}

self.onmessage = async (event) => {
  const message = event.data;
  if (!message || typeof message !== "object") return;
  if (message.type === "instantiate") {
    await instantiate(message);
    return;
  }
  if (message.type === "call") {
    if (!api) {
      self.postMessage({ type: "error", reason: "worker no instanciado" });
      self.close();
      return;
    }
    self.postMessage(await handleMessage(message, api, limits));
    return;
  }
  self.postMessage({ type: "error", reason: "mensaje no soportado" });
};