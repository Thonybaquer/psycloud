import { execSync } from "node:child_process";

const isVercel = !!process.env.VERCEL || process.env.NOW_REGION || process.env.VERCEL_ENV;
const isCI = !!process.env.CI;

if (isVercel) {
  console.log("[postinstall] Detected Vercel environment; skipping electron-builder install-app-deps.");
  process.exit(0);
}

// In local/dev or desktop packaging environments, keep native deps aligned for Electron.
try {
  console.log("[postinstall] Running electron-builder install-app-deps...");
  execSync("npx electron-builder install-app-deps", { stdio: "inherit" });
} catch (err) {
  // Do not hard-fail installs in CI/web-only contexts.
  console.warn("[postinstall] Warning: electron-builder install-app-deps failed. Continuing.");
  if (!isCI) {
    // In local, it is still okay to proceed (user can rerun).
  }
}
