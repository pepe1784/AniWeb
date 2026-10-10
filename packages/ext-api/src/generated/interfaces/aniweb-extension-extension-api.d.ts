/** @module Interface aniweb:extension/extension-api **/
/**
 * Arranque: recibe la configuracion del usuario como JSON (string).
 */
export function init(settings: string): void;
/**
 * Verificacion: debe coincidir con el "id" del manifest instalado.
 */
export function id(): string;
/**
 * --- Manga ---
 */
export function getMangaPopular(page: number): Array<CatalogResult>;
export function getMangaRecent(page: number): Array<CatalogResult>;
export function searchManga(query: string, page: number): Array<CatalogResult>;
export function getMangaDetail(url: string): MangaDetail;
export function getChapters(mangaUrl: string): Array<Chapter>;
export function getMangaPages(chapterUrl: string): Array<MangaPage>;
/**
 * --- Anime ---
 */
export function getAnimePopular(page: number): Array<CatalogResult>;
export function getAnimeRecent(page: number): Array<CatalogResult>;
export function searchAnime(query: string, page: number): Array<CatalogResult>;
export function getEpisodes(animeUrl: string): Array<Episode>;
export function getVideoSources(episodeUrl: string): Array<VideoSource>;
export type Error = import('./aniweb-extension-types.js').Error;
export type CatalogResult = import('./aniweb-extension-types.js').CatalogResult;
export type MangaDetail = import('./aniweb-extension-types.js').MangaDetail;
export type Chapter = import('./aniweb-extension-types.js').Chapter;
export type MangaPage = import('./aniweb-extension-types.js').MangaPage;
export type Episode = import('./aniweb-extension-types.js').Episode;
export type VideoSource = import('./aniweb-extension-types.js').VideoSource;
