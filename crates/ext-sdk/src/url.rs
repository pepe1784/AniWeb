//! Utilidades puras (sin host functions): codificacion de URLs, saneo, etc.

/// Percent-encode RFC 3986 (no codifica los caracteres no reservados).
/// Aplicar a valores de query: `search?q={urlencode(query)}`.
pub fn urlencode(input: &str) -> String {
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    let mut out = String::with_capacity(input.len());
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                out.push(b as char)
            }
            _ => {
                out.push('%');
                out.push(HEX[(b >> 4) as usize] as char);
                out.push(HEX[(b & 0x0f) as usize] as char);
            }
        }
    }
    out
}

/// Une un path relativo a una base. Solo une sintacticamente; para URLs
/// absolutas complejas el host conserva el base del documento.
pub fn join(base: &str, path: &str) -> String {
    if path.starts_with("http://") || path.starts_with("https://") {
        return path.to_string();
    }
    let trimmed_base = base.trim_end_matches('/');
    let trimmed_path = path.trim_start_matches('/');
    format!("{trimmed_base}/{trimmed_path}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn urlencode_basico() {
        assert_eq!(urlencode("hola mundo/ñ"), "hola%20mundo%2F%C3%B1");
        assert_eq!(urlencode("a-b.c_d~e"), "a-b.c_d~e");
        assert_eq!(urlencode(""), "");
    }

    #[test]
    fn join_absoluto_y_relativo() {
        assert_eq!(join("https://a.com/x/", "https://b.com/y"), "https://b.com/y");
        assert_eq!(join("https://a.com/x/", "/y/z"), "https://a.com/x/y/z");
        assert_eq!(join("https://a.com", "y"), "https://a.com/y");
    }
}