import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Workspace pages fetch their data on the client after a bootstrap request,
  // so instant-navigation validation is applied only where a segment opts in.
  experimental: {
    instantInsights: { validationLevel: "manual-warning" },
  },
  serverExternalPackages: ["sharp"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
