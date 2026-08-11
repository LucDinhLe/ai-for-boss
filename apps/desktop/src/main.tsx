import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("AI for Boss root element is missing");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
