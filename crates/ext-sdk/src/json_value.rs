//! Parser JSON puro (sin dependencias) para la extension.
//!
//! La interfaz `json` del host solo devuelve hojas por path y no permite
//! recorrer objetos/arrays anidados (limitacion del contrato WIT: no admite
//! tipos recursivos). Las APIs reales (p. ej. MangaDex con titulos
//! localizados o relaciones) exigen traversal completo, asi que la extension
//! parsea el body que ya recibio por `http`. Este parser es seguro: corre
//! dentro del sandbox WASM de la extension.

/// Valor JSON con traversal completo.
#[derive(Debug, Clone, PartialEq)]
pub enum Json {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<Json>),
    Obj(Vec<(String, Json)>),
}

impl Json {
    /// Parsea un texto JSON completo (rechaza contenido extra al final).
    pub fn parse(input: &str) -> Result<Json, String> {
        let mut p = Parser { b: input.as_bytes(), i: 0 };
        p.ws();
        let value = p.value()?;
        p.ws();
        if p.i != p.b.len() {
            return Err(format!("contenido extra en la posicion {}", p.i));
        }
        Ok(value)
    }

    /// Campo de un objeto por clave.
    pub fn get(&self, key: &str) -> Option<&Json> {
        match self {
            Json::Obj(fields) => fields.iter().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }

    /// Elemento de un array por indice.
    pub fn index(&self, index: usize) -> Option<&Json> {
        match self {
            Json::Arr(items) => items.get(index),
            _ => None,
        }
    }

    /// Traversal por path: "data[0].attributes.title" (claves y indices).
    pub fn path(&self, path: &str) -> Option<&Json> {
        let mut cur = self;
        for segment in path.split('.') {
            if segment.is_empty() {
                return None;
            }
            let key_end = segment.find('[').unwrap_or(segment.len());
            let key = &segment[..key_end];
            if !key.is_empty() {
                cur = cur.get(key)?;
            }
            let mut rest = &segment[key_end..];
            while let Some(stripped) = rest.strip_prefix('[') {
                let close = stripped.find(']')?;
                let index: usize = stripped[..close].parse().ok()?;
                cur = cur.index(index)?;
                rest = &stripped[close + 1..];
            }
        }
        Some(cur)
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Json::Str(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            Json::Num(n) => Some(*n),
            _ => None,
        }
    }

    pub fn as_u64(&self) -> Option<u64> {
        self.as_f64().map(|n| n as u64)
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            Json::Bool(b) => Some(*b),
            _ => None,
        }
    }

    pub fn as_array(&self) -> Option<&[Json]> {
        match self {
            Json::Arr(items) => Some(items),
            _ => None,
        }
    }

    pub fn as_object(&self) -> Option<&[(String, Json)]> {
        match self {
            Json::Obj(fields) => Some(fields),
            _ => None,
        }
    }

    pub fn is_null(&self) -> bool {
        matches!(self, Json::Null)
    }

    /// Primer string util: util para mapas localizados (`{"en": "...", "ja": ...}`).
    /// Si es string lo devuelve; si es objeto, el primer valor string.
    pub fn first_str(&self) -> Option<&str> {
        match self {
            Json::Str(s) => Some(s),
            Json::Obj(fields) => fields.iter().find_map(|(_, v)| v.as_str()),
            _ => None,
        }
    }

    /// Como `first_str` pero devuelve cadena vacia si no hay valor.
    pub fn first_str_or_empty(&self) -> String {
        self.first_str().unwrap_or("").to_string()
    }

    /// String en un path (atajo de `path` + `as_str`).
    pub fn str_at(&self, path: &str) -> Option<&str> {
        self.path(path).and_then(|v| v.as_str())
    }
}

struct Parser<'a> {
    b: &'a [u8],
    i: usize,
}

impl<'a> Parser<'a> {
    fn ws(&mut self) {
        while self.i < self.b.len()
            && matches!(self.b[self.i], b' ' | b'\t' | b'\n' | b'\r')
        {
            self.i += 1;
        }
    }

    fn expect(&mut self, byte: u8) -> Result<(), String> {
        if self.b.get(self.i) == Some(&byte) {
            self.i += 1;
            Ok(())
        } else {
            Err(format!("se esperaba '{}' en la posicion {}", byte as char, self.i))
        }
    }

    fn lit(&mut self, text: &str) -> Result<(), String> {
        if self.b[self.i..].starts_with(text.as_bytes()) {
            self.i += text.len();
            Ok(())
        } else {
            Err(format!("literal invalido en la posicion {}", self.i))
        }
    }

    fn value(&mut self) -> Result<Json, String> {
        self.ws();
        match self.b.get(self.i).copied() {
            Some(b'{') => self.object(),
            Some(b'[') => self.array(),
            Some(b'"') => Ok(Json::Str(self.string()?)),
            Some(b't') => {
                self.lit("true")?;
                Ok(Json::Bool(true))
            }
            Some(b'f') => {
                self.lit("false")?;
                Ok(Json::Bool(false))
            }
            Some(b'n') => {
                self.lit("null")?;
                Ok(Json::Null)
            }
            Some(b'-') | Some(b'0'..=b'9') => self.number(),
            Some(c) => Err(format!("caracter inesperado '{}' en la posicion {}", c as char, self.i)),
            None => Err("fin de entrada inesperado".to_string()),
        }
    }

    fn object(&mut self) -> Result<Json, String> {
        self.expect(b'{')?;
        let mut fields = Vec::new();
        self.ws();
        if self.b.get(self.i) == Some(&b'}') {
            self.i += 1;
            return Ok(Json::Obj(fields));
        }
        loop {
            self.ws();
            let key = self.string()?;
            self.ws();
            self.expect(b':')?;
            let value = self.value()?;
            fields.push((key, value));
            self.ws();
            match self.b.get(self.i) {
                Some(b',') => self.i += 1,
                Some(b'}') => {
                    self.i += 1;
                    break;
                }
                _ => return Err(format!("objeto mal formado en la posicion {}", self.i)),
            }
        }
        Ok(Json::Obj(fields))
    }

    fn array(&mut self) -> Result<Json, String> {
        self.expect(b'[')?;
        let mut items = Vec::new();
        self.ws();
        if self.b.get(self.i) == Some(&b']') {
            self.i += 1;
            return Ok(Json::Arr(items));
        }
        loop {
            let value = self.value()?;
            items.push(value);
            self.ws();
            match self.b.get(self.i) {
                Some(b',') => self.i += 1,
                Some(b']') => {
                    self.i += 1;
                    break;
                }
                _ => return Err(format!("array mal formado en la posicion {}", self.i)),
            }
        }
        Ok(Json::Arr(items))
    }

    fn number(&mut self) -> Result<Json, String> {
        let start = self.i;
        while self.i < self.b.len()
            && matches!(self.b[self.i], b'-' | b'+' | b'0'..=b'9' | b'.' | b'e' | b'E')
        {
            self.i += 1;
        }
        let text = std::str::from_utf8(&self.b[start..self.i])
            .map_err(|_| "numero no es UTF-8".to_string())?;
        text.parse::<f64>()
            .map(Json::Num)
            .map_err(|_| format!("numero invalido: {text}"))
    }

    fn string(&mut self) -> Result<String, String> {
        self.expect(b'"')?;
        let mut out: Vec<u8> = Vec::new();
        loop {
            let byte = *self.b.get(self.i).ok_or("cadena sin cerrar")?;
            self.i += 1;
            match byte {
                b'"' => break,
                b'\\' => {
                    let esc = *self.b.get(self.i).ok_or("escape incompleto")?;
                    self.i += 1;
                    match esc {
                        b'"' => out.push(b'"'),
                        b'\\' => out.push(b'\\'),
                        b'/' => out.push(b'/'),
                        b'b' => out.push(8),
                        b'f' => out.push(12),
                        b'n' => out.push(b'\n'),
                        b'r' => out.push(b'\r'),
                        b't' => out.push(b'\t'),
                        b'u' => {
                            let ch = self.unicode_escape()?;
                            let mut buf = [0u8; 4];
                            out.extend_from_slice(ch.encode_utf8(&mut buf).as_bytes());
                        }
                        other => {
                            return Err(format!("escape invalido \\{}", other as char));
                        }
                    }
                }
                other => out.push(other),
            }
        }
        String::from_utf8(out).map_err(|_| "cadena no es UTF-8 valido".to_string())
    }

    fn unicode_escape(&mut self) -> Result<char, String> {
        let hi = self.hex4()?;
        let code = if (0xD800..=0xDBFF).contains(&hi) {
            if self.b.get(self.i) == Some(&b'\\') && self.b.get(self.i + 1) == Some(&b'u') {
                self.i += 2;
                let lo = self.hex4()?;
                if !(0xDC00..=0xDFFF).contains(&lo) {
                    return Err("surrogate bajo invalido".to_string());
                }
                0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00)
            } else {
                return Err("surrogate alto sin pareja".to_string());
            }
        } else {
            hi
        };
        char::from_u32(code).ok_or_else(|| format!("codepoint invalido: {code}"))
    }

    fn hex4(&mut self) -> Result<u32, String> {
        if self.i + 4 > self.b.len() {
            return Err("escape \\u incompleto".to_string());
        }
        let text = std::str::from_utf8(&self.b[self.i..self.i + 4])
            .map_err(|_| "escape \\u invalido".to_string())?;
        let value = u32::from_str_radix(text, 16)
            .map_err(|_| format!("escape \\u invalido: {text}"))?;
        self.i += 4;
        Ok(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parsea_tipos_basicos() {
        let v = Json::parse(r#"{"a":1,"b":"x","c":true,"d":null,"e":[1,2]}"#).unwrap();
        assert_eq!(v.get("a").unwrap().as_f64(), Some(1.0));
        assert_eq!(v.get("b").unwrap().as_str(), Some("x"));
        assert_eq!(v.get("c").unwrap().as_bool(), Some(true));
        assert!(v.get("d").unwrap().is_null());
        assert_eq!(v.get("e").unwrap().as_array().unwrap().len(), 2);
        assert!(Json::parse("{} trailing").is_err());
    }

    #[test]
    fn traversal_por_path() {
        let v = Json::parse(r#"{"data":[{"id":"7","attributes":{"title":{"en":"Hi","ja":"Yo"}}}]}"#).unwrap();
        assert_eq!(v.str_at("data[0].id"), Some("7"));
        assert_eq!(v.path("data[0].attributes.title").unwrap().first_str(), Some("Hi"));
        assert!(v.path("data[9].id").is_none());
    }

    #[test]
    fn escapes_unicode() {
        let v = Json::parse(r#""hola\n\u00f1 \ud83d\ude00""#).unwrap();
        assert_eq!(v.as_str(), Some("hola\n\u{00f1} \u{1f600}"));
    }
}