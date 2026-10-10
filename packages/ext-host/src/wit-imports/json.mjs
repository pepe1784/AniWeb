// Puente WIT `json`.

import { createJsonHost } from "../json-host.mjs";

const host = createJsonHost();

export const parse = (text) => host.parse(text);
export const get = (doc, path) => host.get(doc, path);
export const getAll = (doc, path) => host.getAll(doc, path);
export const length = (doc, path) => host.length(doc, path);
export const drop = (doc) => host.drop(doc);
