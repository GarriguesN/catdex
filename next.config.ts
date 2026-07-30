import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  turbopack: { root: __dirname },
  async headers() {
    return [
      {
        // Service workers must be revalidated on every load — a long-lived
        // cached /sw.js means an existing install never picks up new event
        // handlers (e.g. the "push" listener added this session) until the
        // browser happens to re-fetch it, which can take a long time under
        // typical static-asset caching. Found while debugging why Web Push
        // wasn't working: this was the most likely silent culprit for
        // already-installed users.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
