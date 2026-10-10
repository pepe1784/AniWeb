/** @module Interface aniweb:extension/logging **/
export function log(level: LogLevel, message: string): void;
/**
 * # Variants
 * 
 * ## `"trace"`
 * 
 * ## `"debug"`
 * 
 * ## `"info"`
 * 
 * ## `"warn"`
 * 
 * ## `"error"`
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
