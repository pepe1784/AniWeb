//! Helpers de logging sobre la host function `logging::log`.

use crate::host::Host;
use crate::types::LogLevel;

pub fn trace(host: &Host, message: &str) {
    (host.log)(LogLevel::Trace, message);
}

pub fn debug(host: &Host, message: &str) {
    (host.log)(LogLevel::Debug, message);
}

pub fn info(host: &Host, message: &str) {
    (host.log)(LogLevel::Info, message);
}

pub fn warn(host: &Host, message: &str) {
    (host.log)(LogLevel::Warn, message);
}

pub fn error(host: &Host, message: &str) {
    (host.log)(LogLevel::Error, message);
}

/// Log con nivel explicito.
pub fn log(host: &Host, level: LogLevel, message: &str) {
    (host.log)(level, message);
}