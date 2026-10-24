import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['wondr-agent'],
  outputFileTracingIncludes: {
    '/api/plan': ['./node_modules/wondr-agent/agent.yaml'],
  },
};

export default nextConfig;
