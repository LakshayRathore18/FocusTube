import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(__dirname, "..") },
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  // Long-running AI generation is bounded to 90 seconds in FastAPI.
  experimental: { proxyTimeout: 120_000 },
  async rewrites() {
    return [{
      source: "/api/:path*",
      destination: `${process.env.BACKEND_URL ?? "http://127.0.0.1:8000"}/api/:path*`,
    }];
  },
  images: {
    remotePatterns: [
      {
        // Google profile pictures (shown in AuthButton avatar)
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        // YouTube thumbnails (used in Step 3 — playlist import)
        protocol: "https",
        hostname: "i.ytimg.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/notes",
        destination: "/learning",
        permanent: true,
      },
      {
        source: "/notes/:path*",
        destination: "/learning/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
