import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @nordhem/shared ships TypeScript source; Next compiles it in-place.
  transpilePackages: ["@nordhem/shared"],
};

export default nextConfig;
