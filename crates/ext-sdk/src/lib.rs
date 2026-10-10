//! AniWeb Ext SDK: SDK Rust de alto nivel para extensiones (componentes WASM).
//!
//! Sin dependencias. La extension genera sus bindings con cargo-component
//! (`src/bindings.rs`) y construye el `Host` con el macro `host!`:
//!
//! ```ignore
//! use aniweb_ext_sdk as sdk;
//!
//! fn run() {
//!     let h = sdk::host!(bindings);
//!     let bytes = sdk::http::get(&h, "https://example.com/x").unwrap();
//! }
//! ```
//!
//! Los tipos públicos (mirror del WIT) viven en `types`; el resto son helpers
//! organizados por dominio: `http`, `json`, `parsing`, `crypto`, `log`, `storage`.

pub mod crypto;
pub mod host;
pub mod http;
pub mod json;
pub mod log;
pub mod parsing;
pub mod storage;
pub mod types;
pub mod url;

pub use host::Host;
pub use json::JsonDoc;
pub use parsing::{Element, HtmlDoc};
pub use types::*;