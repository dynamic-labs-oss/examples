import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Turbopack config (used with --turbopack flag in dev)
  turbopack: {
    resolveAlias: {
      "@gemini-wallet/core": path.resolve(__dirname, "./empty-module.js"),
      "porto": path.resolve(__dirname, "./empty-module.js"),
      "porto/internal": path.resolve(__dirname, "./empty-module.js"),
      "@safe-global/safe-apps-sdk": path.resolve(__dirname, "./empty-module.js"),
      "@safe-global/safe-apps-provider": path.resolve(__dirname, "./empty-module.js"),
      "@base-org/account": path.resolve(__dirname, "./empty-module.js"),
    },
  },

  webpack: (config, { isServer }) => {
    // Add externals for server-side only modules
    config.externals.push("pino-pretty", "lokijs", "encoding");

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webpack = require("webpack");

    // Optional dependencies that may not be installed
    // These are dynamically imported by wagmi connectors and LI.FI
    const optionalDependencies = [
      "@gemini-wallet/core",
      "porto",
      "porto/internal",
      "@safe-global/safe-apps-sdk",
      "@safe-global/safe-apps-provider",
      "@base-org/account",
    ];

    // Replace optional dependencies with empty module for client-side builds
    // This prevents "Module not found" errors for connectors we don't use
    optionalDependencies.forEach((moduleName) => {
      // Handle both exact matches and subpath imports
      const escapedName = moduleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // Replace exact module imports
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          new RegExp(`^${escapedName}$`),
          path.resolve(__dirname, "./empty-module.js")
        )
      );

      // Also replace subpath imports (e.g., @gemini-wallet/core/something)
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          new RegExp(`^${escapedName}/.*$`),
          path.resolve(__dirname, "./empty-module.js")
        )
      );
    });

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
        hostname: "polymarket-upload.s3.us-east-2.amazonaws.com",
      },
    ],
  },
  // Transpile LI.FI packages to ensure compatibility
  transpilePackages: ["@lifi/sdk"],
};

export default nextConfig;
