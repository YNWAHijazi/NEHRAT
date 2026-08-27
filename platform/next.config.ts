import type { NextConfig } from 'next';

const config: NextConfig = {
  // node:sqlite is a Node built-in; keep it external to the server bundle.
  serverExternalPackages: [],
  /**
   * The e2e harness runs its OWN dev server, and two `next dev` processes sharing
   * one build directory corrupt it: the second one's compile deletes chunks the
   * first is still serving, and the running app dies on
   * "ENOENT ... .next/server/app/<route>/page.js". That is precisely what happens
   * whenever the suite runs while the app is open in a browser -- the normal case
   * while reviewing. The harness sets NEXT_DIST_DIR so it builds somewhere else
   * entirely and cannot touch the app's.
   */
  distDir: process.env['NEXT_DIST_DIR'] ?? '.next',
};

export default config;
