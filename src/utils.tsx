/**
 * @module util
 * @license MIT
 */

// Type callback
export type Callback = () => void;

/**
 * @function isFunction
 * @param value
 */
export function isFunction(value: any): value is (...args: any[]) => any {
  return typeof value === 'function';
}
