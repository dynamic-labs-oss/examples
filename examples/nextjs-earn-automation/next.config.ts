import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let the dev server be opened through a Cloudflare quick tunnel (needed for
  // the Dynamic delegation webhook to reach localhost).
  allowedDevOrigins: ["*.trycloudflare.com"],
  serverExternalPackages: [
    "@dynamic-labs-wallet/node",
    "@dynamic-labs-wallet/node-evm",
  ],
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
