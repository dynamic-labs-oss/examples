import type { NextConfig } from "next";
import path from "path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NormalModuleReplacementPlugin } = require("webpack");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Enable WebAssembly — required by @kamino-finance/klend-sdk and @solana/kit
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Required rule for WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });

    // Redirect farms-sdk subpath imports from klend-sdk to the top-level
    // farms-sdk installation. Required when Vercel restores a cached
    // node_modules with stale pnpm virtual-store symlinks for klend-sdk.
    // Uses NormalModuleReplacementPlugin (evaluated at webpack time) rather
    // than resolve.alias or require.resolve (evaluated at config eval time).
    const farmsBase = path.resolve(
      __dirname,
      "node_modules/@kamino-finance/farms-sdk/dist"
    );
    [
      ["@codegen/farms/programId", "programId.js"],
      ["utils/apy", "apy.js"],
      ["utils/option", "option.js"],
    ].forEach(([subpath, file]) => {
      config.plugins.push(
        new NormalModuleReplacementPlugin(
          new RegExp(
            `^@kamino-finance/farms-sdk/dist/${subpath.replace("/", "/")}$`
          ),
          path.join(farmsBase, subpath.replace(/[^/]+$/, ""), file)
        )
      );
    });

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        os: false,
        http: false,
        https: false,
        zlib: false,
      };
    }

    // Dynamic's WaaS bundle includes a WASM attestation package that does not
    // compile under Next.js's asyncWebAssembly mode. Redirect it to an empty
    // module so the rest of the SDK (auth, signing, etc.) works normally.
    config.plugins.push(
      new NormalModuleReplacementPlugin(
        /@evervault\/wasm-attestation-bindings/,
        (resource: { request: string }) => {
          resource.request =
            "data:text/javascript,const PCRs={};const validateAttestationDocPcrs=()=>Promise.resolve();const getUserData=()=>Promise.resolve();const getNonce=()=>Promise.resolve();const init=()=>Promise.resolve();export default init;export{PCRs,validateAttestationDocPcrs,getUserData,getNonce};";
        }
      )
    );

    return config;
  },
};

export default nextConfig;
