import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@agent-runner/core",
    "@agent-runner/manifest",
    "@agent-runner/worker",
  ],
  serverExternalPackages: [
    "@agent-runner/store-postgres",
  ],
};

export default nextConfig;
