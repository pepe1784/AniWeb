/** @module Interface aniweb:extension/parsing **/
export function parse(html: string): number;
export function select(doc: number, selector: string): Uint32Array;
export function elementAttr(element: number, attribute: string): string | undefined;
export function elementText(element: number): string | undefined;
export function elementHtml(element: number): string | undefined;
export function elementParent(element: number): number | undefined;
export function elementChildren(element: number): Uint32Array;
export function drop(doc: number): void;
