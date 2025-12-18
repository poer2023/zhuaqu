import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 部署需要 standalone 模式
  output: "standalone",
  
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/service-worker.js",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
