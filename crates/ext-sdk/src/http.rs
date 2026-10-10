//! Helpers de red sobre la host function `http::request`.

use crate::host::Host;
use crate::json::{parse_doc, JsonDoc};
use crate::types::{Header, HttpError, Range, HttpResponse};

/// Llamada directa a `http::request` con todos los parametros.
pub fn request(
    host: &Host,
    url: &str,
    method: Option<&str>,
    headers: &[Header],
    body: Option<&[u8]>,
    range: Option<Range>,
) -> Result<HttpResponse, HttpError> {
    (host.request)(url, method, headers, body, range)
}

/// GET simple; devuelve el body solo si la respuesta es 2xx.
pub fn get(host: &Host, url: &str) -> Result<Vec<u8>, HttpError> {
    let resp = (host.request)(url, Some("GET"), &[], None, None)?;
    if resp.status >= 200 && resp.status < 300 {
        Ok(resp.body)
    } else {
        Err(HttpError::Network(format!("HTTP {}", resp.status)))
    }
}

/// GET con cabeceras personalizadas y rango opcional.
pub fn get_with_headers(
    host: &Host,
    url: &str,
    headers: &[Header],
    range: Option<Range>,
) -> Result<HttpResponse, HttpError> {
    (host.request)(url, Some("GET"), headers, None, range)
}

/// GET devolviendo el body como texto (UTF-8 estricto; falla si no es UTF-8 valido).
pub fn get_text(host: &Host, url: &str) -> Result<String, HttpError> {
    let bytes = get(host, url)?;
    String::from_utf8(bytes)
        .map_err(|e| HttpError::Network(format!("body no es UTF-8: {e}")))
}

/// GET parseando el body como JSON (conecta http + json del host).
pub fn get_json_doc<'a>(host: &'a Host, url: &str) -> Result<JsonDoc<'a>, HttpError> {
    let bytes = get(host, url)?;
    let text = String::from_utf8(bytes)
        .map_err(|e| HttpError::Network(format!("body no es UTF-8: {e}")))?;
    parse_doc(host, &text).map_err(|e| HttpError::Network(e.to_string()))
}