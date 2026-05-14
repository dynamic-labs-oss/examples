import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@lifi/sdk"],
  webpack: (config, { isServer }) => {
    // Add externals for server-side only modules
    config.externals.push("pino-pretty", "lokijs", "encoding");

    // Add fallback for node modules that might not be available in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "kalshi-public.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "d1u5ehmvvpp8jp.cloudfront.net",
      },
    ],
  },
};

export default nextConfig;

