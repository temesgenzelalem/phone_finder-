import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_API_URL || "https://phone-finder-api.onrender.com";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
