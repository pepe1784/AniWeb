//! Helpers criptograficos sobre las host functions del modulo `crypto`.

use crate::host::Host;

/// Base64 encode (estandar, con padding).
pub fn base64_encode(host: &Host, bytes: &[u8]) -> String {
    (host.base64_encode)(bytes)
}

/// Base64 decode; error como string.
pub fn base64_decode(host: &Host, text: &str) -> Result<Vec<u8>, String> {
    (host.base64_decode)(text)
}

/// SHA-256 en hexadecimal (lowercase).
pub fn sha256_hex(host: &Host, bytes: &[u8]) -> String {
    hex(&(host.sha256)(bytes))
}

/// SHA-256 en bytes crudos.
pub fn sha256_bytes(host: &Host, bytes: &[u8]) -> Vec<u8> {
    (host.sha256)(bytes)
}

/// MD5 en hexadecimal (lowercase).
pub fn md5_hex(host: &Host, bytes: &[u8]) -> String {
    hex(&(host.md5)(bytes))
}

/// MD5 en bytes crudos.
pub fn md5_bytes(host: &Host, bytes: &[u8]) -> Vec<u8> {
    (host.md5)(bytes)
}

/// Codifica bytes a hexadecimal lowercase.
pub fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(DIGITS[(b >> 4) as usize] as char);
        out.push(DIGITS[(b & 0x0f) as usize] as char);
    }
    out
}