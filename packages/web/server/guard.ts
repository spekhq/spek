import type { RequestHandler } from "express";
import { ALLOWED_ORIGINS, allowedHosts } from "./address.js";

/**
 * `same-site` is refused on purpose: a site ignores ports, so every other page on `localhost` is same-site.
 * `none` is a request the user started themselves (typing the URL).
 */
const ALLOWED_FETCH_SITES = new Set(["same-origin", "none"]);

/**
 * Refuse, before any route runs, every request that is not the local app's own:
 * - a `Host` that does not name the API through a loopback name and its port (DNS rebinding),
 * - an `Origin` other than the app's dev origin (another site, another local port, `null`),
 * - a `Sec-Fetch-Site` other than `same-origin` / `none` (cross-site requests that carry no `Origin`,
 *   such as a `<script src>` or a `no-cors` fetch).
 *
 * Withholding a CORS header is not enough: the request would still run, and a `no-cors` request needs no
 * header to have its effect. Requests without browser headers (curl, scripts) are subject to the `Host` rule only.
 */
export function localAppOnly(port: number): RequestHandler {
  const hosts = allowedHosts(port);
  return (req, res, next) => {
    const host = req.headers.host?.toLowerCase();
    const origin = req.headers.origin;
    const fetchSite = req.headers["sec-fetch-site"];
    let refusal: string | null = null;
    if (!host || !hosts.has(host)) refusal = "Host not allowed";
    else if (origin !== undefined && !ALLOWED_ORIGINS.has(origin)) refusal = "Origin not allowed";
    else if (typeof fetchSite === "string" && !ALLOWED_FETCH_SITES.has(fetchSite)) refusal = "Cross-site request not allowed";
    if (refusal) {
      res.status(403).json({ error: refusal });
      return;
    }
    next();
  };
}
