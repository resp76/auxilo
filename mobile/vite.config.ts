import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Separate from the root vinext build: this one emits a plain static bundle
// for Capacitor to package. postcss lives at the repo root, so point at it.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  css: { postcss: fileURLToPath(new URL("..", import.meta.url)) },
  build: { outDir: "dist", emptyOutDir: true },
});
