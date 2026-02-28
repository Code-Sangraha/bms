import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: 'dist', // Build to dist folder
  
  // Enable static export (generates HTML files)
  output: 'export',
  
  // Required for static export
  images: {
    unoptimized: true, // Images work without optimization server
  },
  
  // Optional: Disable server-side features if not needed
  // trailingSlash: true, // Adds trailing slashes to paths
  
  // Configure Turbopack path aliases
  turbopack: {
    resolveAlias: {
      '~/*': './src/*',
    },
  },
};

export default nextConfig;