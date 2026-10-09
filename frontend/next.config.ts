import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    const configured = process.env.BACKEND_URL;
    if (process.env.NODE_ENV === 'production' && !configured) {
      throw new Error('Set BACKEND_URL to the Express backend origin before building the frontend.');
    }
    const backend = new URL(configured || 'http://localhost:3001');
    if (!['http:', 'https:'].includes(backend.protocol) || backend.username || backend.password || backend.search || backend.hash || backend.pathname !== '/') throw new Error('BACKEND_URL must be a plain HTTP(S) origin.');
    return [
      {
        source: "/api/:path*",
        destination: `${backend.origin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
