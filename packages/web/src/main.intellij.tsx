import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IntellijApp } from "./IntellijApp";
import "./styles/global.css";

// 標記宿主，與 VS Code 的 __vscodeApi、Demo 的 __DEMO_DATA__ 同一套慣例。
// useFileWatcher 需要它才能認出 IntelliJ；沒有標記時它會誤判成 Web 而對
// /api/openspec/watch 開 EventSource —— IntelliJ 內建 server 不服務該路徑，只會永遠重連失敗。
(window as unknown as Record<string, unknown>).__spekIntellij = true;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <IntellijApp />
  </StrictMode>,
);
