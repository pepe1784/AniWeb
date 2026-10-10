// Entrada del Cloudflare Worker. Reutiliza el núcleo compartido.
import { handle } from "./proxy-core.mjs";

export default {
  fetch(request, env) {
    return handle(request, env);
  },
};
