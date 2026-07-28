import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-side rendering — NO static export (we need API routes + auth)
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
  // Increase body size for photo uploads (10MB)
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
