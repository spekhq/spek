import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WebviewApp } from "./WebviewApp";
import { webviewLinkClickAction } from "./utils/webviewLinkGuard";
import "./styles/global.css";

// acquireVsCodeApi 只能呼叫一次，存到全域供 MessageAdapter 使用
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscodeApi = acquireVsCodeApi();
(window as unknown as Record<string, unknown>).__vscodeApi = vscodeApi;

// Keep in-app link clicks away from VS Code's host script, which forwards every anchor click to the
// workbench from a bubble-phase `window` listener; in a browser-hosted VS Code that opens a broken tab
// per sidebar click (issue #59). A bubble-phase `document` listener runs after React's root listener
// and before that `window` one. See utils/webviewLinkGuard.ts for which clicks are kept.
document.addEventListener("click", (event) => {
  const anchor = event
    .composedPath()
    .find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement && node.hasAttribute("href"));
  if (!anchor) return;
  const action = webviewLinkClickAction({
    hrefAttribute: anchor.getAttribute("href") ?? "",
    href: anchor.href,
    documentHref: window.location.href,
    handled: event.defaultPrevented,
  });
  if (action === "block") {
    event.preventDefault();
    event.stopPropagation();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WebviewApp />
  </StrictMode>,
);

// 通知 extension host 我們已經 ready
vscodeApi.postMessage({ type: "ready" });
