//! Utilidades de texto puras (sin host functions) para extraer datos de HTML y
//! de payloads JS embebidos en `<script>`.
//!
//! Muchas fuentes (AnimeAV1, MangaOni) no exponen JSON: publican los datos en
//! scripts inline (`episodes:[...]`, `embeds:{...}`) o en variables base64. El
//! host no trae motor de regex y el contrato WIT no lo contempla, asi que la
//! extension usa estos helpers deterministas y probados en vez de regex.

/// Subcadena entre `start` y la siguiente `end` (ambos exclusivos). Si no
/// aparece `end`, devuelve el resto.
pub fn between<'a>(text: &'a str, start: &str, end: &str) -> Option<&'a str> {
    let begin = text.find(start)? + start.len();
    let rest = &text[begin..];
    let finish = rest.find(end).unwrap_or(rest.len());
    Some(&rest[..finish])
}

/// Contenido del primer `[...]` que sigue a `key` (equivale a
/// `key\s*:\s*\[([^]]*)]`, salvo que ignora espacios).
pub fn bracket_after<'a>(text: &'a str, key: &str) -> Option<&'a str> {
    let at = text.find(key)? + key.len();
    let after = &text[at..];
    let open = after.find('[')?;
    let inner = &after[open + 1..];
    let close = inner.find(']')?;
    Some(&inner[..close])
}

/// Trocea en objetos `{...}` (sin anidar llaves): devuelve el interior de cada
/// par de llaves del primer nivel de profundidad.
pub fn objects(text: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut rest = text;
    while let Some(open) = rest.find('{') {
        let after = &rest[open + 1..];
        let Some(close) = after.find('}') else {
            break;
        };
        out.push(&after[..close]);
        rest = &after[close + 1..];
    }
    out
}

/// Valor de un campo estilo JS/JSON `key: value` (tolera espacios tras los dos
/// puntos). Si el valor va entre comillas devuelve el interior; si no, devuelve
/// el token hasta la siguiente coma, llave o final.
pub fn value_after<'a>(object: &'a str, key: &str) -> Option<&'a str> {
    let at = object.find(key)? + key.len();
    let after = object[at..].trim_start();
    let after = after.strip_prefix(':')?.trim_start();
    if let Some(quoted) = after.strip_prefix('"') {
        let end = quoted.find('"')?;
        return Some(&quoted[..end]);
    }
    let end = after.find([',', '}']).unwrap_or(after.len());
    let token = after[..end].trim();
    if token.is_empty() {
        None
    } else {
        Some(token)
    }
}

/// Ultimo segmento no vacio del path de una URL (slug o id), ignorando query y
/// fragmento.
pub fn slug(url: &str) -> String {
    let without = url.split(['?', '#']).next().unwrap_or(url);
    let trimmed = without.trim_end_matches('/');
    trimmed.rsplit('/').next().unwrap_or(trimmed).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn between_markers() {
        assert_eq!(between("a<var>hola</var>b", "<var>", "</var>"), Some("hola"));
        assert_eq!(between("sin fin", "in", "zzz"), Some(" fin"));
        assert_eq!(between("nada", "xx", "yy"), None);
    }

    #[test]
    fn unicap_base() {
        let html = "var unicap = 'QUJD';\n";
        assert_eq!(between(html, "var unicap = '", "'"), Some("QUJD"));
    }

    #[test]
    fn episodios_reales() {
        // Fragmento real del script de AnimeAV1.
        let script = r#"node_ids:[0,2],episodes:[{id:2336,number:1},{id:2339.5,number:2}]}"#;
        let arr = bracket_after(script, "episodes").unwrap();
        let items = objects(arr);
        assert_eq!(items.len(), 2);
        assert_eq!(value_after(items[0], "number"), Some("1"));
        assert_eq!(value_after(items[0], "id"), Some("2336"));
        assert_eq!(value_after(items[1], "number"), Some("2"));
    }

    #[test]
    fn servidores_embeds() {
        // Fragmento real del script de AnimeAV1.
        let script = concat!(
            r#"embeds:{DUB:[{server:"HLS",url:"https://player.zilla-networks.com/play/abc"}"#,
            r#"],SUB:[{server:"Voe",url:"https://voe.sx/e/zqx"}]},downloads:{DUB:[]}"#,
        );
        let block = between(script, "embeds:", "downloads:").unwrap();
        let dub = bracket_after(block, "DUB").unwrap();
        let dub_obj = objects(dub);
        assert_eq!(value_after(dub_obj[0], "server"), Some("HLS"));
        assert_eq!(
            value_after(dub_obj[0], "url"),
            Some("https://player.zilla-networks.com/play/abc")
        );
        let sub = bracket_after(block, "SUB").unwrap();
        let sub_obj = objects(sub);
        assert_eq!(value_after(sub_obj[0], "server"), Some("Voe"));
    }

    #[test]
    fn slug_de_urls() {
        assert_eq!(slug("https://manga-oni.com/manga/one-punch-man/"), "one-punch-man");
        assert_eq!(slug("https://manga-oni.com/lector/one-punch-man/811515/?x=1"), "811515");
        assert_eq!(slug("/media/shingeki-no-kyojin"), "shingeki-no-kyojin");
    }
}
