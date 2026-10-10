/** @module Interface aniweb:extension/storage **/
export function get(key: string): string | undefined;
export function set(key: string, value: string): void;
export function keys(): Array<string>;
