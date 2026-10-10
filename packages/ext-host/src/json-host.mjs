// Host `json` (handles + paths) del runtime de extensiones.
//
// El host conserva el arbol JSON y la extension solo ve handles u32 y paths de
// texto. Refleja exactamente la interface `json` de `packages/ext-api/wit`.
// Los errores se lanzan como el `json-error` que espera jco:
//   { tag: "parse", val: mensaje } | { tag: "invalid-path" }
// y el valor ok se devuelve directamente (jco devuelve el payload en exito).

const MISSING = Symbol("missing");

// Parsea "a.b[0].c" o "data.results[*].id" en tokens.
// Lanza { tag: "invalid-path" } ante sintaxis invalida.
export function parsePath(path) {
  if (typeof path !== "string" || path.length === 0) throw { tag: "invalid-path" };
  const tokens = [];
  const n = path.length;
  let i = 0;
  while (i < n) {
    const ch = path[i];
    if (ch === ".") {
      i++;
      continue;
    }
    if (ch === "[") {
      const close = path.indexOf("]", i);
      if (close === -1) throw { tag: "invalid-path" };
      const inner = path.slice(i + 1, close);
      if (inner === "*") tokens.push({ wildcard: true });
      else if (/^\d+$/.test(inner)) tokens.push({ index: Number(inner) });
      else throw { tag: "invalid-path" };
      i = close + 1;
    } else {
      let j = i;
      while (j < n && path[j] !== "." && path[j] !== "[") j++;
      const key = path.slice(i, j);
      if (!key) throw { tag: "invalid-path" };
      tokens.push({ key });
      i = j;
    }
  }
  if (!tokens.length) throw { tag: "invalid-path" };
  return tokens;
}

function step(node, token) {
  if (token.key !== undefined) {
    if (node && typeof node === "object" && !Array.isArray(node) && token.key in node) {
      return node[token.key];
    }
    return MISSING;
  }
  if (token.index !== undefined) {
    if (Array.isArray(node) && token.index < node.length) return node[token.index];
    return MISSING;
  }
  return MISSING;
}

// Convierte un valor JSON en la hoja `json-value` del WIT, o null si no es hoja.
function toLeaf(value) {
  if (value === null) return { tag: "null" };
  if (typeof value === "boolean") return { tag: "boolean", val: value };
  if (typeof value === "number") return { tag: "number", val: value };
  if (typeof value === "string") return { tag: "str", val: value };
  return null;
}

export function createJsonHost() {
  const docs = new Map();
  let nextHandle = 1;

  function doc(handle) {
    if (!docs.has(handle)) throw { tag: "invalid-path" };
    return docs.get(handle);
  }

  function parse(text) {
    let value;
    try {
      value = JSON.parse(text);
    } catch (error) {
      throw { tag: "parse", val: String(error && error.message ? error.message : error) };
    }
    const handle = nextHandle++;
    docs.set(handle, value);
    return handle;
  }

  function get(handle, path) {
    const tokens = parsePath(path);
    if (tokens.some((token) => token.wildcard)) throw { tag: "invalid-path" };
    let node = doc(handle);
    for (const token of tokens) {
      node = step(node, token);
      if (node === MISSING) throw { tag: "invalid-path" };
    }
    const leaf = toLeaf(node);
    if (!leaf) throw { tag: "invalid-path" };
    return leaf;
  }

  function getAll(handle, path) {
    const tokens = parsePath(path);
    let nodes = [doc(handle)];
    for (const token of tokens) {
      const next = [];
      for (const node of nodes) {
        if (token.wildcard) {
          if (Array.isArray(node)) next.push(...node);
        } else {
          const child = step(node, token);
          if (child !== MISSING) next.push(child);
        }
      }
      nodes = next;
    }
    const out = [];
    for (const node of nodes) {
      const leaf = toLeaf(node);
      if (leaf) out.push(leaf);
    }
    return out;
  }

  function length(handle, path) {
    const tokens = parsePath(path);
    if (tokens.some((token) => token.wildcard)) throw { tag: "invalid-path" };
    let node = doc(handle);
    for (const token of tokens) {
      node = step(node, token);
      if (node === MISSING) throw { tag: "invalid-path" };
    }
    if (!Array.isArray(node)) throw { tag: "invalid-path" };
    return node.length;
  }

  function drop(handle) {
    docs.delete(handle);
  }

  return { parse, get, getAll, length, drop };
}
