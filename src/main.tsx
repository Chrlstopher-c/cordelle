import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";

async function start(): Promise<void> {
  if (import.meta.env.VITE_MOCK === "1") (await import("./dev/mock-tauri")).installMock();
  const root = document.getElementById("root");
  if (!root) return;
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void start();
