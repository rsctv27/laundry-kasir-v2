// Perintah build di Vercel (lihat vercel.json):
//   1. jalankan migrasi database yang belum jalan
//   2. bangun aplikasi kasir versi web ke public/kasir
//   3. next build
// Lokal tanpa migrasi: SKIP_MIGRATE=1 node scripts/vercel-build.mjs
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: webDir, stdio: "inherit", ...opts });

if (process.env.VERCEL && (process.env.BETTER_AUTH_SECRET ?? "").length < 32) {
  console.error("BETTER_AUTH_SECRET belum diisi (minimal 32 karakter) di Environment Variables Vercel. Build dihentikan.");
  process.exit(1);
}

if (process.env.SKIP_MIGRATE !== "1") {
  // Migrasi lewat koneksi langsung (bukan pooler) bila tersedia.
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL belum diisi di Environment Variables Vercel. Build dihentikan.");
    process.exit(1);
  }
  run("npx", ["tsx", join(webDir, "..", "..", "packages", "db", "src", "migrate.ts")], {
    env: { ...process.env, DATABASE_URL: url },
  });
}
run("node", [join(webDir, "scripts", "bundle-kasir.mjs")]);
run("npx", ["next", "build"]);
