import test from "node:test";
import assert from "node:assert/strict";
import { createParsingHost, parseSelector } from "../src/parsing-host.mjs";

const HTML = `<div id="article-div">
  <article class="post">
    <a itemprop="url" href="/manga/one">
      <img data-src="/img/one.webp" alt="One">
      <b>Manga</b>
      <h3>Uno</h3>
    </a>
  </article>
  <article class="post">
    <a itemprop="url" href="/manga/two">
      <img data-src="/img/two.webp" alt="Two">
      <b>Manhwa</b>
      <h3>Dos</h3>
    </a>
  </article>
</div>`;

test("parseSelector rechaza lo no soportado", () => {
  assert.equal(parseSelector("a:first-child"), null);
  assert.equal(parseSelector("a + article"), null);
  assert.equal(parseSelector("a ~ b"), null);
  assert.ok(parseSelector("#article-div a[itemprop='url']"));
});

test("select encuentra tarjetas por id + atributo", () => {
  const host = createParsingHost();
  const doc = host.parse(HTML);
  const links = host.select(doc, '#article-div a[itemprop="url"]');
  assert.equal(links.length, 2);
  assert.equal(host.elementAttr(links[0], "href"), "/manga/one");
  assert.equal(host.elementAttr(links[1], "href"), "/manga/two");
});

test("select soporta descendiente, hijo y clase", () => {
  const host = createParsingHost();
  const doc = host.parse(HTML);
  assert.equal(host.select(doc, "article a").length, 2);
  assert.equal(host.select(doc, "#article-div > article").length, 2);
  assert.equal(host.select(doc, "article.post").length, 2);
  assert.equal(host.select(doc, "#article-div > a").length, 0);
});

test("elementAttr devuelve imagenes con data-src", () => {
  const host = createParsingHost();
  const doc = host.parse(HTML);
  const imgs = host.select(doc, "a img");
  assert.equal(imgs.length, 2);
  assert.equal(host.elementAttr(imgs[0], "data-src"), "/img/one.webp");
  assert.equal(host.elementAttr(imgs[0], "alt"), "One");
  assert.equal(host.elementAttr(imgs[0], "missing"), undefined);
});

test("elementText normaliza espacios y elementHtml serializa", () => {
  const host = createParsingHost();
  const doc = host.parse(HTML);
  const types = host.select(doc, "b");
  assert.equal(host.elementText(types[0]), "Manga");
  assert.equal(host.elementText(types[1]), "Manhwa");
  const div = host.select(doc, "#article-div")[0];
  assert.equal(host.elementText(div), "Manga Uno Manhwa Dos");
  assert.match(host.elementHtml(div), /<img data-src="\/img\/one\.webp" alt="One">/);
});

test("elementParent y elementChildren navegan el arbol", () => {
  const host = createParsingHost();
  const doc = host.parse(HTML);
  const b = host.select(doc, "b")[0];
  const parent = host.elementParent(b);
  assert.equal(host.elementAttr(parent, "href"), "/manga/one");
  const children = host.elementChildren(parent);
  assert.equal(children.length, 3); // img, b, h3
});

test("selector no soportado devuelve lista vacia", () => {
  const host = createParsingHost();
  const doc = host.parse(HTML);
  assert.deepEqual(host.select(doc, "b:first-child"), []);
});

test("drop invalida el documento", () => {
  const host = createParsingHost();
  const doc = host.parse(HTML);
  host.drop(doc);
  assert.deepEqual(host.select(doc, "b"), []);
});
