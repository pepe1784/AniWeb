/** @module Interface aniweb:extension/types **/
export type Error = ErrorMessage | ErrorNotSupported | ErrorNoResults | ErrorTimeout;
export interface ErrorMessage {
  tag: 'message',
  val: string,
}
export interface ErrorNotSupported {
  tag: 'not-supported',
}
export interface ErrorNoResults {
  tag: 'no-results',
}
export interface ErrorTimeout {
  tag: 'timeout',
}
export interface Header {
  name: string,
  value: string,
}
/**
 * # Variants
 * 
 * ## `"safe"`
 * 
 * ## `"suggestive"`
 * 
 * ## `"nsfw"`
 */
export type NsfwLevel = 'safe' | 'suggestive' | 'nsfw';
export interface CatalogResult {
  id: string,
  title: string,
  url: string,
  thumbnailUrl: string,
  author?: string,
  status?: string,
}
export interface Chapter {
  id: string,
  name: string,
  url: string,
  scanlator?: string,
  uploadedAt?: string,
  pageCount?: number,
}
export interface MangaPage {
  url: string,
  index: number,
  headers: Array<Header>,
}
export interface MangaDetail {
  id: string,
  title: string,
  url: string,
  thumbnailUrl: string,
  author?: string,
  artist?: string,
  status?: string,
  description?: string,
  genres: Array<string>,
  nsfw: NsfwLevel,
  chapters: Array<Chapter>,
}
export interface Episode {
  id: string,
  name: string,
  url: string,
  uploadedAt?: string,
}
export interface Quality {
  url: string,
  quality?: string,
  format?: string,
  headers: Array<Header>,
}
export interface Subtitle {
  url: string,
  lang?: string,
  format?: string,
}
export interface VideoSource {
  serverName: string,
  qualities: Array<Quality>,
  subtitles: Array<Subtitle>,
}
