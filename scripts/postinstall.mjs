import { spawnSync } from "node:child_process";

// Vercel builds don't need Electron native deps (and they can break the build).
// We only run electron-builder install-app-deps when building the desktop app locally/CI.
const isVercel = !!process.env.VERCEL;
const skip = isVercel;

if (skip) {
  console.log("[postinstall] Skipping electron-builder install-app-deps on Vercel.");
  process.exit(0);
}

console.log("[postinstall] Running: electron-builder install-app-deps");
const res = spawnSync("npx", ["electron-builder", "install-app-deps"], { stdio: "inherit", shell: true });

process.exit(res.status ?? 0);
