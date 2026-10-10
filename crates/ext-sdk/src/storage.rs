//! Helpers de almacenamiento clave/valor aislado por extension.

use crate::host::Host;

pub fn get(host: &Host, key: &str) -> Option<String> {
    (host.storage_get)(key)
}

pub fn set(host: &Host, key: &str, value: &str) {
    (host.storage_set)(key, value);
}

pub fn keys(host: &Host) -> Vec<String> {
    (host.storage_keys)()
}

/// Atajo: lee y convierte a bool ("true"/"false").
pub fn get_bool(host: &Host, key: &str) -> bool {
    get(host, key).map(|v| v == "true").unwrap_or(false)
}

/// Atajo: escribe un bool.
pub fn set_bool(host: &Host, key: &str, value: bool) {
    set(host, key, if value { "true" } else { "false" });
}