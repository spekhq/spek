/**
 * Where the web app's API server listens and whom it answers — one module, read by the server and by
 * `vite.config.ts`. A port copied by hand into either side would let a change in one silently lock the app
 * out of its own API, which reads as "the API is down" rather than as a config error.
 */

/** IPv4 loopback as a literal: `localhost` resolves to `::1` first on some systems and `127.0.0.1` on others. */
export const API_HOST = "127.0.0.1";
export const API_PORT = 3001;
/** The Vite dev server's port. `strictPort` keeps it fixed, since the API admits exactly this app origin. */
export const APP_PORT = 5173;

const LOOPBACK_NAMES = ["localhost", "127.0.0.1", "[::1]"];

/** `Host` values the API answers: a loopback name plus the API port. Anything else is DNS rebinding or a mistake. */
export function allowedHosts(port: number = API_PORT): Set<string> {
  return new Set(LOOPBACK_NAMES.map((name) => `${name}:${port}`));
}

/** `Origin` values the API answers: the app's own dev origin, under each loopback name. */
export const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
  LOOPBACK_NAMES.map((name) => `http://${name}:${APP_PORT}`),
);
