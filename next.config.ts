import type { NextConfig } from "next";
import path from "path";

const stylesPath = path.join(process.cwd(), "src", "styles");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  sassOptions: {
    // sass-loader uses the modern Sass API; both option names are
    // accepted by Sass but `loadPaths` is the canonical modern one.
    loadPaths: [stylesPath],
    includePaths: [stylesPath],
  },
};

export default nextConfig;
