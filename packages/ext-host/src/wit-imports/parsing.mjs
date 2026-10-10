// Puente WIT `parsing`. Los handles viajan como u32; las listas como Uint32Array.

import { createParsingHost } from "../parsing-host.mjs";

const host = createParsingHost();

export const parse = (html) => host.parse(html);
export const select = (doc, selector) => Uint32Array.from(host.select(doc, selector));
export const elementAttr = (element, attribute) => host.elementAttr(element, attribute);
export const elementText = (element) => host.elementText(element);
export const elementHtml = (element) => host.elementHtml(element);
export const elementParent = (element) => host.elementParent(element);
export const elementChildren = (element) => Uint32Array.from(host.elementChildren(element));
export const drop = (doc) => host.drop(doc);
