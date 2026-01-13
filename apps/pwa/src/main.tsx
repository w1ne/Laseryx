import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./ui/App";
import { registerServiceWorker } from "./io/registerServiceWorker";

registerServiceWorker();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
