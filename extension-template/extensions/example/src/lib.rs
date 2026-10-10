//! Plantilla de extension AniWeb (componente WASM).
//!
//! Implementa la interfaz `extension-api` definida en `wit/extension.wit`
//! (spec en `docs/04-wit-extensiones.md` del proyecto AniWeb).
//!
//! `src/bindings.rs` se genera automaticamente por cargo-component en cada
//! build; no editar. Las host functions importadas viven bajo
//! `bindings::aniweb::extension::*` (http, parsing, json, crypto, logging,
//! storage) para cuando la extension necesite usarlas.

#[allow(warnings)]
mod bindings;

use bindings::exports::aniweb::extension::extension_api::*;

/// Debe coincidir con "id" de `extension-metadata.json` (lo exige el loader).
const EXTENSION_ID: &str = "example";

struct Extension;

impl Guest for Extension {
    fn init(settings: String) -> Result<(), Error> {
        // Recibe la configuracion del usuario como JSON (string) y la guarda
        // con storage o en un static mut una vez que exista la necesidad.
        let _ = settings;
        Ok(())
    }

    fn id() -> String {
        EXTENSION_ID.to_string()
    }

    // --- Manga ---

    fn get_manga_popular(page: u32) -> Result<Vec<CatalogResult>, Error> {
        let _ = page;
        Err(Error::NotSupported)
    }

    fn get_manga_recent(page: u32) -> Result<Vec<CatalogResult>, Error> {
        let _ = page;
        Err(Error::NotSupported)
    }

    fn search_manga(query: String, page: u32) -> Result<Vec<CatalogResult>, Error> {
        let _ = (query, page);
        Err(Error::NotSupported)
    }

    fn get_manga_detail(url: String) -> Result<MangaDetail, Error> {
        let _ = url;
        Err(Error::NotSupported)
    }

    fn get_chapters(manga_url: String) -> Result<Vec<Chapter>, Error> {
        let _ = manga_url;
        Err(Error::NotSupported)
    }

    fn get_manga_pages(chapter_url: String) -> Result<Vec<MangaPage>, Error> {
        let _ = chapter_url;
        Err(Error::NotSupported)
    }

    // --- Anime ---

    fn get_anime_popular(page: u32) -> Result<Vec<CatalogResult>, Error> {
        let _ = page;
        Err(Error::NotSupported)
    }

    fn get_anime_recent(page: u32) -> Result<Vec<CatalogResult>, Error> {
        let _ = page;
        Err(Error::NotSupported)
    }

    fn search_anime(query: String, page: u32) -> Result<Vec<CatalogResult>, Error> {
        let _ = (query, page);
        Err(Error::NotSupported)
    }

    fn get_episodes(anime_url: String) -> Result<Vec<Episode>, Error> {
        let _ = anime_url;
        Err(Error::NotSupported)
    }

    fn get_video_sources(episode_url: String) -> Result<Vec<VideoSource>, Error> {
        let _ = episode_url;
        Err(Error::NotSupported)
    }
}

bindings::export!(Extension with_types_in bindings);