import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const target = new URL("public/excalidraw-assets/fonts/", root);
await mkdir(target, { recursive: true });
await cp(
  fileURLToPath(
    new URL("node_modules/@excalidraw/excalidraw/dist/prod/fonts/", root),
  ),
  fileURLToPath(target),
  { recursive: true },
);
console.log("Excalidraw fonts prepared for local use.");
