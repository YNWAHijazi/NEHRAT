import type { NextConfig } from 'next';

const config: NextConfig = {
  // node:sqlite is a Node built-in; keep it external to the server bundle.
  serverExternalPackages: [],
};

export default config;
