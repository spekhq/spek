// Which link clicks the VS Code webview must keep away from its host (issue #59).
//
// VS Code's webview host script listens for `click` on the webview's `window` (bubble phase) and forwards
// every `<a href>` it sees to the workbench to open — it never reads `defaultPrevented`. Desktop VS Code
// serves the webview from `vscode-webview://`, which the workbench refuses to open, so an in-app route
// link was dropped silently; a browser-hosted VS Code (code-server, Codespaces, vscode.dev) serves it
// from `https://` and opens a broken tab for every sidebar click. `main.webview.tsx` applies this rule
// from a `document` listener, which runs after React and before VS Code's `window` listener.

export type LinkClickAction = "pass" | "block";

export interface LinkClick {
  /** The anchor's `href` attribute as written (`getAttribute("href")`). */
  hrefAttribute: string;
  /** The anchor's resolved URL (`anchor.href`). */
  href: string;
  /** The webview document's URL (`location.href`). */
  documentHref: string;
  /** Whether the app already handled the click (`event.defaultPrevented`). */
  handled: boolean;
}

/**
 * `pass` leaves the click to VS Code as before; `block` means the caller calls `preventDefault()` and
 * `stopPropagation()`, so neither the host nor the browser's default navigation acts on it.
 *
 * In-app is judged by protocol + host, not `URL.origin`: for a non-special scheme such as
 * `vscode-webview:` the origin serialises as `"null"`, which would make every desktop link look external.
 */
export function webviewLinkClickAction(click: LinkClick): LinkClickAction {
  let target: URL;
  let page: URL;
  try {
    target = new URL(click.href);
    page = new URL(click.documentHref);
  } catch {
    return "pass";
  }

  // Another scheme or host (https://github.com/…, mailto:) — VS Code opens it, as it always has.
  if (target.protocol !== page.protocol || target.host !== page.host) return "pass";

  // A bare `#fragment` (including `#`) is scrolled by VS Code itself unless the app already did it.
  if (click.hrefAttribute.startsWith("#")) return click.handled ? "block" : "pass";

  // Any other in-app link: the app navigated, or nothing may open it — least of all a new browser tab.
  return "block";
}
