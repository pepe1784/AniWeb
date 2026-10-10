/** @module Interface aniweb:extension/crypto **/
export function base64Encode(bytes: Uint8Array): string;
export function base64Decode(text: string): Uint8Array;
export function sha256(bytes: Uint8Array): Uint8Array;
export function md5(bytes: Uint8Array): Uint8Array;
