// Membangun aplikasi kasir versi web (Expo) dan menaruhnya di apps/web/public/kasir,
// supaya web owner, API, dan kasir disajikan dari satu alamat: https://domain/kasir.
//   node scripts/bundle-kasir.mjs
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "/kasir";
const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const kasirDir = join(webDir, "..", "kasir");
const dist = join(kasirDir, "dist");
const out = join(webDir, "public", "kasir");

rmSync(dist, { recursive: true, force: true });
execFileSync("npx", ["expo", "export", "--platform", "web", "--output-dir", "dist", "--clear"], {
  cwd: kasirDir,
  stdio: "inherit",
  env: {
    ...process.env,
    EXPO_BASE_URL: BASE,
    EXPO_PUBLIC_API_URL: "same-origin",
    EXPO_OFFLINE: "1",
    EXPO_NO_TELEMETRY: "1",
    NODE_ENV: "production",
  },
});
if (!existsSync(join(dist, "index.html"))) throw new Error("Ekspor kasir gagal: dist/index.html tidak ada");

// Template public/index.html memakai path absolut; arahkan ke subpath.
const indexPath = join(dist, "index.html");
let html = readFileSync(indexPath, "utf8");
html = html
  .replaceAll('href="/manifest.webmanifest"', `href="${BASE}/manifest.webmanifest"`)
  .replaceAll('href="/icons/', `href="${BASE}/icons/`);
writeFileSync(indexPath, html);

const manifestPath = join(dist, "manifest.webmanifest");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.id = `${BASE}/`;
manifest.start_url = `${BASE}/`;
manifest.scope = `${BASE}/`;
manifest.icons = manifest.icons.map((i) => ({ ...i, src: i.src.startsWith(BASE) ? i.src : `${BASE}${i.src}` }));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

rmSync(out, { recursive: true, force: true });
cpSync(dist, out, { recursive: true });
console.log(`kasir web siap di public${BASE}`);
