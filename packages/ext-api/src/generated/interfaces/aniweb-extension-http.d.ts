/** @module Interface aniweb:extension/http **/
export function request(url: string, method: string | undefined, headers: Array<Header>, body: Uint8Array | undefined, range: Range | undefined): HttpResponse;
export type Header = import('./aniweb-extension-types.js').Header;
export interface Range {
  start: bigint,
  end?: bigint,
}
export interface HttpResponse {
  status: number,
  headers: Array<Header>,
  body: Uint8Array,
}
export type HttpError = HttpErrorBlocked | HttpErrorTimeout | HttpErrorTooLarge | HttpErrorInvalidUrl | HttpErrorNetwork;
export interface HttpErrorBlocked {
  tag: 'blocked',
}
export interface HttpErrorTimeout {
  tag: 'timeout',
}
export interface HttpErrorTooLarge {
  tag: 'too-large',
}
export interface HttpErrorInvalidUrl {
  tag: 'invalid-url',
}
export interface HttpErrorNetwork {
  tag: 'network',
  val: string,
}
