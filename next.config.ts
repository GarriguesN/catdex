import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  turbopack: { root: __dirname },
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
