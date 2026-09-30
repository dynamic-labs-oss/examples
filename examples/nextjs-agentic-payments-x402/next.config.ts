import type { NextConfig } from "next";

/**
 * Security response headers applied to every route. `frame-ancestors 'none'`
 * (plus X-Frame-Options) blocks clickjacking of this wallet/payments UI; the
 * rest harden MIME sniffing, referrer leakage, transport security, and browser
 * feature access. This CSP only restricts framing — it intentionally does not
 * add a script/connect allowlist (that would need to enumerate the Dynamic SDK's
 * endpoints); add one before a hardened production launch.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@dynamic-labs-wallet/node",
    "@dynamic-labs-wallet/node-evm",
  ],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

module.exports = nextConfig;
