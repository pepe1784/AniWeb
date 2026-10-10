//! Host: punteros a las host functions del contrato, con tipos espejo del SDK.
//!
//! La extension no adapta nada a mano: el macro `host!` genera los adapters a
//! partir del modulo `bindings` que cargo-component genera en el crate raiz.

use crate::types::{
    Header, HttpResponse, HttpError, JsonError, JsonValue, LogLevel, Range,
};

/// Conjunto de host functions que la extension importa del contrato WIT.
/// Construir solo via el macro `host!`; es Copy (solo punteros a fn).
#[derive(Debug, Clone, Copy)]
pub struct Host {
    // --- http ---
    pub request:
        fn(&str, Option<&str>, &[Header], Option<&[u8]>, Option<Range>) -> Result<HttpResponse, HttpError>,
    // --- json ---
    pub json_parse: fn(&str) -> Result<u32, JsonError>,
    pub json_get: fn(u32, &str) -> Result<JsonValue, JsonError>,
    pub json_get_all: fn(u32, &str) -> Result<Vec<JsonValue>, JsonError>,
    pub json_length: fn(u32, &str) -> Result<u32, JsonError>,
    pub json_drop: fn(u32),
    // --- parsing ---
    pub parse: fn(&str) -> u32,
    pub select: fn(u32, &str) -> Vec<u32>,
    pub element_attr: fn(u32, &str) -> Option<String>,
    pub element_text: fn(u32) -> Option<String>,
    pub element_html: fn(u32) -> Option<String>,
    pub element_parent: fn(u32) -> Option<u32>,
    pub element_children: fn(u32) -> Vec<u32>,
    pub drop: fn(u32),
    // --- crypto ---
    pub base64_encode: fn(&[u8]) -> String,
    pub base64_decode: fn(&str) -> Result<Vec<u8>, String>,
    pub sha256: fn(&[u8]) -> Vec<u8>,
    pub md5: fn(&[u8]) -> Vec<u8>,
    // --- logging ---
    pub log: fn(LogLevel, &str),
    // --- storage ---
    pub storage_get: fn(&str) -> Option<String>,
    pub storage_set: fn(&str, &str),
    pub storage_keys: fn() -> Vec<String>,
}

/// Genera un `Host` adaptando el modulo `bindings` de la extension
/// (el que cargo-component genera en `src/bindings.rs`).
///
/// Uso en la extension:
/// ```ignore
/// use aniweb_ext_sdk as sdk;
/// let h = sdk::host!(bindings);
/// ```
#[macro_export]
macro_rules! host {
    ($bindings:path) => {{
        use $bindings as __b;

        $crate::host::Host {
            request: |url, method, headers, body, range| {
                let b_headers = headers
                    .iter()
                    .map(|h| __b::aniweb::extension::types::Header {
                        name: h.name.clone(),
                        value: h.value.clone(),
                    })
                    .collect::<Vec<_>>();
                __b::aniweb::extension::http::request(
                    url,
                    method,
                    &b_headers,
                    body,
                    range.map(|r| __b::aniweb::extension::http::Range {
                        start: r.start,
                        end: r.end,
                    }),
                )
                .map(|resp| $crate::types::HttpResponse {
                    status: resp.status,
                    headers: resp
                        .headers
                        .into_iter()
                        .map(|h| $crate::types::Header { name: h.name, value: h.value })
                        .collect(),
                    body: resp.body,
                })
                .map_err(|e| match e {
                    __b::aniweb::extension::http::HttpError::Blocked => $crate::types::HttpError::Blocked,
                    __b::aniweb::extension::http::HttpError::Timeout => $crate::types::HttpError::Timeout,
                    __b::aniweb::extension::http::HttpError::TooLarge => $crate::types::HttpError::TooLarge,
                    __b::aniweb::extension::http::HttpError::InvalidUrl => $crate::types::HttpError::InvalidUrl,
                    __b::aniweb::extension::http::HttpError::Network(msg) => {
                        $crate::types::HttpError::Network(msg)
                    }
                })
            },
            json_parse: |text| {
                __b::aniweb::extension::json::parse(text).map_err(|e| match e {
                    __b::aniweb::extension::json::JsonError::Parse(msg) => {
                        $crate::types::JsonError::Parse(msg)
                    }
                    __b::aniweb::extension::json::JsonError::InvalidPath => {
                        $crate::types::JsonError::InvalidPath
                    }
                })
            },
            json_get: |doc, path| {
                __b::aniweb::extension::json::get(doc, path)
                    .map(|v| match v {
                        __b::aniweb::extension::json::JsonValue::Null => {
                            $crate::types::JsonValue::Null
                        }
                        __b::aniweb::extension::json::JsonValue::Boolean(b) => {
                            $crate::types::JsonValue::Bool(b)
                        }
                        __b::aniweb::extension::json::JsonValue::Number(n) => {
                            $crate::types::JsonValue::Number(n)
                        }
                        __b::aniweb::extension::json::JsonValue::Str(s) => {
                            $crate::types::JsonValue::Str(s)
                        }
                    })
                    .map_err(|e| match e {
                        __b::aniweb::extension::json::JsonError::Parse(msg) => {
                            $crate::types::JsonError::Parse(msg)
                        }
                        __b::aniweb::extension::json::JsonError::InvalidPath => {
                            $crate::types::JsonError::InvalidPath
                        }
                    })
            },
            json_get_all: |doc, path| {
                __b::aniweb::extension::json::get_all(doc, path)
                    .map(|list| {
                        list.into_iter()
                            .map(|v| match v {
                                __b::aniweb::extension::json::JsonValue::Null => {
                                    $crate::types::JsonValue::Null
                                }
                                __b::aniweb::extension::json::JsonValue::Boolean(b) => {
                                    $crate::types::JsonValue::Bool(b)
                                }
                                __b::aniweb::extension::json::JsonValue::Number(n) => {
                                    $crate::types::JsonValue::Number(n)
                                }
                                __b::aniweb::extension::json::JsonValue::Str(s) => {
                                    $crate::types::JsonValue::Str(s)
                                }
                            })
                            .collect()
                    })
                    .map_err(|e| match e {
                        __b::aniweb::extension::json::JsonError::Parse(msg) => {
                            $crate::types::JsonError::Parse(msg)
                        }
                        __b::aniweb::extension::json::JsonError::InvalidPath => {
                            $crate::types::JsonError::InvalidPath
                        }
                    })
            },
            json_length: |doc, path| {
                __b::aniweb::extension::json::length(doc, path).map_err(|e| match e {
                    __b::aniweb::extension::json::JsonError::Parse(msg) => {
                        $crate::types::JsonError::Parse(msg)
                    }
                    __b::aniweb::extension::json::JsonError::InvalidPath => {
                        $crate::types::JsonError::InvalidPath
                    }
                })
            },
            json_drop: |doc| __b::aniweb::extension::json::drop(doc),
            parse: |html| __b::aniweb::extension::parsing::parse(html),
            select: |doc, selector| __b::aniweb::extension::parsing::select(doc, selector),
            element_attr: |element, attribute| {
                __b::aniweb::extension::parsing::element_attr(element, attribute)
            },
            element_text: |element| __b::aniweb::extension::parsing::element_text(element),
            element_html: |element| __b::aniweb::extension::parsing::element_html(element),
            element_parent: |element| __b::aniweb::extension::parsing::element_parent(element),
            element_children: |element| __b::aniweb::extension::parsing::element_children(element),
            drop: |doc| __b::aniweb::extension::parsing::drop(doc),
            base64_encode: |bytes| __b::aniweb::extension::crypto::base64_encode(bytes),
            base64_decode: |text| __b::aniweb::extension::crypto::base64_decode(text),
            sha256: |bytes| __b::aniweb::extension::crypto::sha256(bytes),
            md5: |bytes| __b::aniweb::extension::crypto::md5(bytes),
            log: |level, message| {
                let b_level = match level {
                    $crate::types::LogLevel::Trace => __b::aniweb::extension::logging::LogLevel::Trace,
                    $crate::types::LogLevel::Debug => __b::aniweb::extension::logging::LogLevel::Debug,
                    $crate::types::LogLevel::Info => __b::aniweb::extension::logging::LogLevel::Info,
                    $crate::types::LogLevel::Warn => __b::aniweb::extension::logging::LogLevel::Warn,
                    $crate::types::LogLevel::Error => __b::aniweb::extension::logging::LogLevel::Error,
                };
                __b::aniweb::extension::logging::log(b_level, message)
            },
            storage_get: |key| __b::aniweb::extension::storage::get(key),
            storage_set: |key, value| __b::aniweb::extension::storage::set(key, value),
            storage_keys: || __b::aniweb::extension::storage::keys(),
        }
    }};
}