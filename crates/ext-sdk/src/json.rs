//! Helpers JSON sobre las host functions del modulo `json`.
//!
//! El host conserva el arbol del documento; `JsonDoc` es un handle u32 con
//! RAII: al dropearse llama a `json_drop` del host.

use crate::host::Host;
use crate::types::{JsonError, JsonValue};

/// Documento JSON con ciclo de vida gestionado por RAII.
pub struct JsonDoc<'a> {
    pub(crate) handle: u32,
    pub(crate) host: &'a Host,
}

impl<'a> JsonDoc<'a> {
    /// Parsea `text` y devuelve un documento (el host conserva el arbol).
    pub fn parse(host: &'a Host, text: &str) -> Result<Self, JsonError> {
        parse_doc(host, text)
    }

    /// Lee un valor hoja por path: "data.results[0].title".
    pub fn get(&self, path: &str) -> Result<JsonValue, JsonError> {
        (self.host.json_get)(self.handle, path)
    }

    /// String opcional en un path.
    pub fn get_str(&self, path: &str) -> Result<Option<String>, JsonError> {
        self.get(path).map(|v| v.as_str().map(|s| s.to_string()))
    }

    /// Numero opcional en un path.
    pub fn get_f64(&self, path: &str) -> Result<Option<f64>, JsonError> {
        self.get(path).map(|v| v.as_f64())
    }

    /// Entero opcional en un path.
    pub fn get_u64(&self, path: &str) -> Result<Option<u64>, JsonError> {
        self.get(path).map(|v| v.as_u64())
    }

    /// Booleano opcional en un path.
    pub fn get_bool(&self, path: &str) -> Result<Option<bool>, JsonError> {
        self.get(path).map(|v| v.as_bool())
    }

    /// Todos los valores hoja de un path con comodin: "data.results[*].id".
    pub fn get_all(&self, path: &str) -> Result<Vec<JsonValue>, JsonError> {
        (self.host.json_get_all)(self.handle, path)
    }

    /// Todos los strings de un path con comodin (ignora no-strings).
    pub fn get_all_str(&self, path: &str) -> Result<Vec<String>, JsonError> {
        self.get_all(path).map(|list| {
            list.into_iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
    }

    /// Longitud de una lista: "data.results".
    pub fn length(&self, path: &str) -> Result<u32, JsonError> {
        (self.host.json_length)(self.handle, path)
    }
}

impl<'a> Drop for JsonDoc<'a> {
    fn drop(&mut self) {
        (self.host.json_drop)(self.handle);
    }
}

/// Parsea un texto JSON; el host conserva el arbol. Devuelve el handle envuelto.
pub fn parse_doc<'a>(host: &'a Host, text: &str) -> Result<JsonDoc<'a>, JsonError> {
    (host.json_parse)(text).map(|handle| JsonDoc { handle, host })
}