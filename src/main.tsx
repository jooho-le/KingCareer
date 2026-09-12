import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./kingcareer.css";

// The editor is lazy-loaded after this setup; fonts are served by Vite locally.
Object.assign(window, { EXCALIDRAW_ASSET_PATH: "/excalidraw-assets/" });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
