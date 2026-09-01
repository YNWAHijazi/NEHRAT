import type { NextConfig } from 'next';

const config: NextConfig = {
  // The deployed image runs the literal output of this build -- nothing regenerates
  // between here and the container, so nothing can drift. Standalone lands at
  // `${distDir}/standalone`, so it composes with the separate harness build below.
  output: 'standalone',
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
  // `||`, NOT `??`. `??` only catches undefined, and an environment variable added
  // through a hosting dashboard with the value field left blank is an EMPTY STRING --
  // not nullish. NEXT_DIST_DIR="" would have given distDir: '', which is the same
  // shape as the bug found in the provisioning command today: a check that answers a
  // narrower question than the one it looks like it answers.
  distDir: process.env['NEXT_DIST_DIR'] || '.next',
};

export default config;
