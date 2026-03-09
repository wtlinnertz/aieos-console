import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  webpack: (config) => {
    // Allow .js extensions in imports to resolve to .ts files.
    // Several service files use explicit .js extensions (ESM convention)
    // which webpack does not resolve to .ts by default.
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      ...config.resolve.extensionAlias,
    };
    return config;
  },
};

export default nextConfig;
