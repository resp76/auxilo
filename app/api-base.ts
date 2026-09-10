/**
 * On the web the app is served by the worker, so /api/* is same-origin.
 *
 * Inside the Capacitor shell the bundle is served from capacitor://localhost
 * with no server behind it, so those same paths must point at the deployed
 * worker. Detected at runtime rather than at build time so one codebase and
 * one build of the components serve both.
 */
// Anything that is not plain http(s) is a native shell: iOS serves the bundle
// from capacitor://localhost, and other schemes (ionic://, file://) behave the
// same way. Matching on "not web" rather than one scheme avoids silently
// falling back to same-origin URLs that have no server behind them.
export const isNativeShell =
  typeof window !== "undefined" && !/^https?:$/.test(window.location.protocol);

export const API_BASE = isNativeShell ? "https://auxilo.app" : "";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
