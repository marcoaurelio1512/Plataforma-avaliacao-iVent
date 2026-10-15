import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.tsx";
import { reloadForNewVersion } from "./lib/lazyPage.ts";
import { initTheme } from "./lib/theme.ts";
import "./styles/tokens.css";
import "./styles/base.css";

initTheme();

// O Vite avisa quando um arquivo de pré-carga sumiu (publicação nova): recarrega uma vez.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
