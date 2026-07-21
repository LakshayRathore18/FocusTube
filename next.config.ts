import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
