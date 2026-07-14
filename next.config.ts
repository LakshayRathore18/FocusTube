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
};

export default nextConfig;
