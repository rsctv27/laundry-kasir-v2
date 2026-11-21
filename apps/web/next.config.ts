import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@lk/shared", "@lk/db"],
  serverExternalPackages: ["postgres"],
  poweredByHeader: false,
};
export default config;
