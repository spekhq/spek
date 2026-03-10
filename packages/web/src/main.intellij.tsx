import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IntellijApp } from "./IntellijApp";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <IntellijApp />
  </StrictMode>,
);
