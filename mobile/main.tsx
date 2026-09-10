/**
 * Static entry for the Capacitor shell. The dashboard tree is plain React with
 * no framework imports, so the same components the worker renders on the web
 * are mounted here and bundled into the app — no remote URL, works offline.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import Home from "../app/page";

const root = document.getElementById("root");
if (root) createRoot(root).render(<StrictMode><Home /></StrictMode>);
