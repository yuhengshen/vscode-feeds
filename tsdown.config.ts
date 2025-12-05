import { defineConfig } from "tsdown";

export default defineConfig([
  // Main extension
  {
    entry: ["src/extension.ts"],
    format: ["cjs"],
    target: "node18",
    minify: true,
    external: ["vscode"],
  },
  // Webview bundle
  {
    entry: { main: "src/twitter/webview/main.ts" },
    outDir: "dist/webview",
    format: ["iife"],
    target: "es2020",
    minify: true,
    platform: "browser",
    noExternal: ["lit-html"],
  },
]);
