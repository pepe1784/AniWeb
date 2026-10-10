//! Tipos espejo del contrato WIT (aniweb:extension). Son estructuras Rust
//! planas usadas por el Host y los helpers; los adapters que convierten desde
//! los tipos generados por cargo-component viven en el macro `host!`.

/// Cabecera HTTP (mismo shape que `header` del WIT).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Header {
    pub name: String,
    pub value: String,
}

impl Header {
    pub fn new(name: impl Into<String>, value: impl Into<String>) -> Self {
        Self { name: name.into(), value: value.into() }
    }
}

/// Rango de bytes para descargas parciales (`range` del WIT).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Range {
    pub start: u64,
    pub end: Option<u64>,
}

impl Range {
    pub fn from(start: u64, end: Option<u64>) -> Self {
        Self { start, end }
    }
}

/// Respuesta HTTP (`http-response` del WIT).
#[derive(Debug, Clone)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: Vec<Header>,
    pub body: Vec<u8>,
}

/// Error de red (`http-error` del WIT).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HttpError {
    Blocked,
    Timeout,
    TooLarge,
    InvalidUrl,
    Network(String),
}

impl core::fmt::Display for HttpError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            HttpError::Blocked => write!(f, "solicitud bloqueada por el host"),
            HttpError::Timeout => write!(f, "tiempo de espera agotado"),
            HttpError::TooLarge => write!(f, "respuesta demasiado grande"),
            HttpError::InvalidUrl => write!(f, "url invalida"),
            HttpError::Network(msg) => write!(f, "error de red: {msg}"),
        }
    }
}

/// Error de JSON (`json-error` del WIT).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JsonError {
    Parse(String),
    InvalidPath,
}

impl core::fmt::Display for JsonError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            JsonError::Parse(msg) => write!(f, "json invalido: {msg}"),
            JsonError::InvalidPath => write!(f, "path invalido o apunta a un objeto/array"),
        }
    }
}

/// Valor JSON de hoja (`json-value` del WIT).
#[derive(Debug, Clone, PartialEq)]
pub enum JsonValue {
    Null,
    Bool(bool),
    Number(f64),
    Str(String),
}

impl JsonValue {
    pub fn as_str(&self) -> Option<&str> {
        match self {
            JsonValue::Str(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            JsonValue::Number(n) => Some(*n),
            _ => None,
        }
    }

    pub fn as_u64(&self) -> Option<u64> {
        self.as_f64().map(|n| n as u64)
    }

    pub fn as_i64(&self) -> Option<i64> {
        self.as_f64().map(|n| n as i64)
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            JsonValue::Bool(b) => Some(*b),
            _ => None,
        }
    }

    pub fn is_null(&self) -> bool {
        matches!(self, JsonValue::Null)
    }

    /// Concatena una cadena vacia para valores Null (comodidad para campos opcionales).
    pub fn unwrap_or_empty(&self) -> String {
        self.as_str().unwrap_or("").to_string()
    }
}

/// Nivel de log (`log-level` del WIT).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}