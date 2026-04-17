import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack's root to this app. Without this, Next.js walks up to the
  // repo-root package-lock.json (used only for Biome) and tries to resolve
  // app dependencies like tailwindcss from there.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
