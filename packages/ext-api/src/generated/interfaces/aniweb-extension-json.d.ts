/** @module Interface aniweb:extension/json **/
/**
 * Parsea un texto JSON y devuelve un handle de documento (el host conserva el arbol).
 */
export function parse(text: string): number;
/**
 * Lee un valor hoja por path desde el documento.
 * Paths: "data.results[0].title" (objetos y arrays). Apuntar a un objeto o array da invalid-path.
 */
export function get(doc: number, path: string): JsonValue;
/**
 * Lee todos los valores hoja de un path con comodin: "data.results[*].id".
 */
export function getAll(doc: number, path: string): Array<JsonValue>;
/**
 * Longitud de una lista: "data.results".
 */
export function length(doc: number, path: string): number;
export function drop(doc: number): void;
export type JsonValue = JsonValueNull | JsonValueBoolean | JsonValueNumber | JsonValueStr;
export interface JsonValueNull {
  tag: 'null',
}
export interface JsonValueBoolean {
  tag: 'boolean',
  val: boolean,
}
export interface JsonValueNumber {
  tag: 'number',
  val: number,
}
export interface JsonValueStr {
  tag: 'str',
  val: string,
}
export type JsonError = JsonErrorParse | JsonErrorInvalidPath;
export interface JsonErrorParse {
  tag: 'parse',
  val: string,
}
export interface JsonErrorInvalidPath {
  tag: 'invalid-path',
}
