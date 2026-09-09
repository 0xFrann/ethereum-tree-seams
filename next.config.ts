import type { NextConfig } from "next";

// The site is a static export: every page is rendered once at build time and
// served as plain files, so it deploys unchanged to GitHub Pages or Vercel.
// BASE_PATH lets a GitHub Pages project site live under /<repository>.
const basePath = process.env.BASE_PATH?.replace(/\/$/, "") || undefined;

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath ?? "" },
};

export default nextConfig;
