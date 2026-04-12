import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@agent-runner/core",
    "@agent-runner/manifest",
    "@agent-runner/worker",
  ],
};

export default nextConfig;
