import type { NextConfig } from "next";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NormalModuleReplacementPlugin } = require("webpack");

const nextConfig: NextConfig = {
  // This app doesn't use next/image, so don't expose the image optimizer as an
  // open proxy for arbitrary remote hosts (it was `hostname: "**"`).
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
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
