// Host `parsing` (parser HTML con selectores CSS, handles u32) del runtime.
//
// El host conserva el arbol; la extension solo ve handles u32 y selectores.
// Es un parser tolerante y un subconjunto de CSS suficiente para scraping:
//   - compuestos: tag, `*`, `#id`, `.clase`, `[attr]`, `[attr=valor]`
//   - combinadores: descendiente (espacio) e hijo (`>`)
//   - grupos: separados por coma
// Lo que no soporta (pseudo-clases, `+`, `~`, operadores de atributo distintos
// de `=`) hace que el selector entero devuelva lista vacia, como especifica
// `docs/04-wit-extensiones.md`.

const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

function findTagEnd(html, start) {
  let quote = null;
  for (let i = start + 1; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return i;
    }
  }
  return -1;
}

function parseStartTag(raw) {
  const n = raw.length;
  let i = 0;
  while (i < n && /\s/.test(raw[i])) i++;
  let j = i;
  while (j < n && !/[\s/>]/.test(raw[j])) j++;
  const tag = raw.slice(i, j).toLowerCase();
  const attrs = new Map();
  i = j;
  while (i < n) {
    while (i < n && /\s/.test(raw[i])) i++;
    if (i >= n) break;
    if (raw[i] === "/") {
      i++;
      continue;
    }
    let k = i;
    while (k < n && !/[\s=/>]/.test(raw[k])) k++;
    const name = raw.slice(i, k).toLowerCase();
    i = k;
    if (!name) {
      i++;
      continue;
    }
    while (i < n && /\s/.test(raw[i])) i++;
    let value = "";
    if (raw[i] === "=") {
      i++;
      while (i < n && /\s/.test(raw[i])) i++;
      if (raw[i] === '"' || raw[i] === "'") {
        const quote = raw[i];
        i++;
        const s = i;
        while (i < n && raw[i] !== quote) i++;
        value = raw.slice(s, i);
        if (raw[i] === quote) i++;
      } else {
        const s = i;
        while (i < n && !/[\s>]/.test(raw[i])) i++;
        value = raw.slice(s, i);
      }
    }
    attrs.set(name, value);
  }
  return { tag, attrs, selfClose: /\/\s*$/.test(raw) };
}

// Construye un arbol tolerante. Devuelve el nodo raiz (#root).
export function parseHtml(html) {
  const root = { type: "element", tag: "#root", attrs: new Map(), children: [], parent: null, order: 0 };
  const stack = [root];
  let order = 1;
  const text = String(html);

  const addText = (value) => {
    if (!value) return;
    const parent = stack[stack.length - 1];
    parent.children.push({ type: "text", text: value, parent, order: order++ });
  };
  const closeTag = (tag) => {
    for (let k = stack.length - 1; k > 0; k--) {
      if (stack[k].tag === tag) {
        stack.length = k;
        return;
      }
    }
  };

  let i = 0;
  while (i < text.length) {
    const lt = text.indexOf("<", i);
    if (lt === -1) {
      addText(text.slice(i));
      break;
    }
    if (lt > i) addText(text.slice(i, lt));
    if (text.startsWith("<!--", lt)) {
      const end = text.indexOf("-->", lt + 4);
      i = end === -1 ? text.length : end + 3;
      continue;
    }
    if (text.startsWith("<!", lt) || text.startsWith("<?", lt)) {
      const end = text.indexOf(">", lt);
      i = end === -1 ? text.length : end + 1;
      continue;
    }
    if (text[lt + 1] === "/") {
      const end = text.indexOf(">", lt);
      if (end === -1) break;
      closeTag(text.slice(lt + 2, end).trim().toLowerCase());
      i = end + 1;
      continue;
    }
    const end = findTagEnd(text, lt);
    if (end === -1) {
      addText(text.slice(lt));
      break;
    }
    const { tag, attrs, selfClose } = parseStartTag(text.slice(lt + 1, end));
    if (tag) {
      const parent = stack[stack.length - 1];
      const el = { type: "element", tag, attrs, children: [], parent, order: order++ };
      parent.children.push(el);
      if (!selfClose && !VOID.has(tag)) stack.push(el);
    }
    i = end + 1;
  }
  return root;
}

function getAttr(el, name) {
  if (!el.attrs || !el.attrs.has(name)) return null;
  return el.attrs.get(name);
}

function parseCompound(text) {
  const simple = { tag: null, id: null, classes: [], attrs: [] };
  const n = text.length;
  let i = 0;
  while (i < n) {
    const ch = text[i];
    if (ch === "*") {
      simple.tag = "*";
      i++;
    } else if (ch === "#" || ch === ".") {
      i++;
      let j = i;
      while (j < n && ".#[".indexOf(text[j]) === -1) j++;
      const value = text.slice(i, j);
      if (!value) return null;
      if (ch === "#") simple.id = value;
      else simple.classes.push(value);
      i = j;
    } else if (ch === "[") {
      const close = text.indexOf("]", i);
      if (close === -1) return null;
      const inner = text.slice(i + 1, close);
      i = close + 1;
      const eq = inner.indexOf("=");
      if (eq === -1) {
        simple.attrs.push({ name: inner.trim().toLowerCase() });
      } else {
        const name = inner.slice(0, eq).trim().toLowerCase();
        let value = inner.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        simple.attrs.push({ name, value });
      }
    } else {
      let j = i;
      while (j < n && ".#[".indexOf(text[j]) === -1) j++;
      simple.tag = text.slice(i, j).toLowerCase();
      i = j;
    }
  }
  if (!simple.tag && !simple.id && !simple.classes.length && !simple.attrs.length) return null;
  return simple;
}

// Devuelve las partes `{ comb, simple }` o null si el selector no es soportado.
export function parseSelector(selector) {
  const groups = String(selector).split(",").map((s) => s.trim()).filter(Boolean);
  if (!groups.length) return null;
  const parsed = [];
  for (const group of groups) {
    const raw = group.replace(/\s*>\s*/g, " > ").trim().split(/\s+/);
    const parts = [];
    let comb = " ";
    for (const token of raw) {
      if (token === ">") {
        comb = ">";
        continue;
      }
      if (token === "+" || token === "~") return null;
      if (token.includes(":")) return null; // pseudo-clases no soportadas
      const simple = parseCompound(token);
      if (!simple) return null;
      parts.push({ comb, simple });
      comb = " ";
    }
    if (!parts.length) return null;
    parsed.push(parts);
  }
  return parsed;
}

function matchSimple(el, simple) {
  if (el.type !== "element") return false;
  if (simple.tag && simple.tag !== "*" && el.tag !== simple.tag) return false;
  if (simple.id && getAttr(el, "id") !== simple.id) return false;
  if (simple.classes.length) {
    const classes = (getAttr(el, "class") || "").split(/\s+/);
    for (const c of simple.classes) if (!classes.includes(c)) return false;
  }
  for (const a of simple.attrs) {
    const value = getAttr(el, a.name);
    if (value === null) return false;
    if (a.value !== undefined && value !== a.value) return false;
  }
  return true;
}

function matchChain(el, parts, k) {
  if (!matchSimple(el, parts[k].simple)) return false;
  if (k === 0) return true;
  if (parts[k].comb === ">") {
    return el.parent ? matchChain(el.parent, parts, k - 1) : false;
  }
  let p = el.parent;
  while (p) {
    if (matchChain(p, parts, k - 1)) return true;
    p = p.parent;
  }
  return false;
}

function collectElements(node, out) {
  for (const child of node.children || []) {
    if (child.type === "element") {
      out.push(child);
      collectElements(child, out);
    }
  }
  return out;
}

function textContent(node) {
  let out = "";
  for (const child of node.children || []) {
    if (child.type === "text") out += child.text;
    else out += textContent(child);
  }
  return out;
}

function serialize(node) {
  let out = "";
  for (const child of node.children || []) {
    if (child.type === "text") {
      out += child.text;
    } else {
      out += "<" + child.tag;
      for (const [name, value] of child.attrs) out += value === "" ? ` ${name}` : ` ${name}="${value}"`;
      out += ">";
      out += serialize(child);
      if (!VOID.has(child.tag)) out += `</${child.tag}>`;
    }
  }
  return out;
}

export function createParsingHost() {
  const handles = new Map(); // handle -> node
  let nextHandle = 1;

  function add(node) {
    if (node.__handle && handles.get(node.__handle) === node) return node.__handle;
    const handle = nextHandle++;
    node.__handle = handle;
    handles.set(handle, node);
    return handle;
  }

  function nodeOf(handle) {
    return handles.get(handle);
  }

  function parse(html) {
    return add(parseHtml(html));
  }

  function select(doc, selector) {
    const root = nodeOf(doc);
    if (!root) return [];
    const groups = parseSelector(selector);
    if (!groups) return [];
    const all = collectElements(root, []);
    const seen = new Set();
    const matched = [];
    for (const group of groups) {
      for (const el of all) {
        if (matchChain(el, group, group.length - 1) && !seen.has(el)) {
          seen.add(el);
          matched.push(el);
        }
      }
    }
    matched.sort((a, b) => a.order - b.order);
    return matched.map(add);
  }

  function elementAttr(handle, attribute) {
    const node = nodeOf(handle);
    if (!node || node.type !== "element") return undefined;
    const value = getAttr(node, String(attribute).toLowerCase());
    return value === null ? undefined : value;
  }

  function elementText(handle) {
    const node = nodeOf(handle);
    if (!node) return undefined;
    const text = textContent(node).replace(/\s+/g, " ").trim();
    return text || undefined;
  }

  function elementHtml(handle) {
    const node = nodeOf(handle);
    if (!node || node.type !== "element") return undefined;
    return serialize(node);
  }

  function elementParent(handle) {
    const node = nodeOf(handle);
    if (!node || !node.parent || node.parent.tag === "#root") return undefined;
    return add(node.parent);
  }

  function elementChildren(handle) {
    const node = nodeOf(handle);
    if (!node) return [];
    return (node.children || []).filter((c) => c.type === "element").map(add);
  }

  function drop(doc) {
    const root = nodeOf(doc);
    if (root) {
      const stack = [root];
      while (stack.length) {
        const node = stack.pop();
        if (node.__handle !== undefined) {
          handles.delete(node.__handle);
          delete node.__handle;
        }
        for (const child of node.children || []) stack.push(child);
      }
    }
    handles.delete(doc);
  }

  return { parse, select, elementAttr, elementText, elementHtml, elementParent, elementChildren, drop };
}
