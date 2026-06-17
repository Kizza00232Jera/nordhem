import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them in-place.
  transpilePackages: ["@nordhem/shared", "@nordhem/db"],
  // Allow the dev server's hot-reload socket to be reached from LAN devices
  // (e.g. testing the storefront on a phone over the same Wi-Fi).
  allowedDevOrigins: ["192.168.1.156"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      // Pexels is the other approved hotlink source (catalog photos + the
      // image-rejudge swaps); see CLAUDE.md "Unsplash/Pexels photos".
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
};

export default nextConfig;
