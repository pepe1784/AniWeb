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
//!
//! `json_value` aporta un parser JSON puro con traversal completo (objetos y
//! arrays anidados), que la interfaz `json` del host no puede ofrecer porque el
//! contrato WIT no admite tipos recursivos. Se usa con `http::get_json`.

pub mod crypto;
pub mod host;
pub mod http;
pub mod json;
pub mod json_value;
pub mod log;
pub mod parsing;
pub mod storage;
pub mod text;
pub mod types;
pub mod url;

pub use host::Host;
pub use json::JsonDoc;
pub use json_value::Json;
pub use parsing::{Element, HtmlDoc};
pub use types::*;