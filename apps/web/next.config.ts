import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const config: NextConfig = {
  transpilePackages: ["@lk/shared", "@lk/db"],
  serverExternalPackages: ["postgres"],
  poweredByHeader: false,
  // Monorepo: paket workspace dan node_modules ada di root.
  outputFileTracingRoot: root,
  turbopack: { root },
  async rewrites() {
    return {
      // Aplikasi kasir (public/kasir) adalah single-page app: semua alamat /kasir/... yang bukan file dilayani index.html.
      fallback: [
        { source: "/kasir", destination: "/kasir/index.html" },
        { source: "/kasir/:path*", destination: "/kasir/index.html" },
      ],
    };
  },
  async headers() {
    return [
      // index.html kasir selalu dicek ulang supaya versi baru langsung terpakai; file ber-hash di _expo boleh di-cache lama.
      { source: "/kasir/_expo/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      ...(process.env.ALLOW_INDEXING === "1"
        ? []
        : [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }]),
    ];
  },
};
export default config;
