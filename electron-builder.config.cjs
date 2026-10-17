// Detect if a real signing certificate is available.
// When set, the build will sign with hardened runtime + entitlements and notarize.
// When unset, electron-builder's default ad-hoc signing runs without
// hardenedRuntime or entitlements — avoiding the Team ID mismatch crash on arm64.
const hasSigningIdentity =
  process.env.CSC_NAME ||
  process.env.CSC_LINK ||
  process.env.APPLE_IDENTITY;

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.cadmus.app',
  productName: 'Cadmus',
  mac: {
    category: 'public.app-category.productivity',
    target: ['dmg', 'zip'],
    icon: 'resources/icon.icns',
    ...(hasSigningIdentity
      ? {
          identity: process.env.APPLE_IDENTITY || process.env.CSC_NAME || undefined,
          hardenedRuntime: true,
          gatekeeperAssess: false,
          entitlements: 'build/entitlements.mac.plist',
          entitlementsInherit: 'build/entitlements.mac.inherit.plist',
        }
      : {
          // No certificate — skip signing entirely so Electron's own
          // pre-signed binaries stay intact and Team IDs stay consistent.
          identity: null,
        }),
  },
  ...(hasSigningIdentity ? { afterSign: 'scripts/notarize.cjs' } : {}),
  // electron-builder leaves DMGs unsigned by default; sign it too when signing the app.
  ...(hasSigningIdentity ? { dmg: { sign: true } } : {}),
  directories: {
    output: 'dist',
    buildResources: 'resources',
  },
  files: ['out/**/*', 'package.json'],
  extraResources: [
    {
      from: 'src/workspaces/screenplay/assets/defaults',
      to: 'assets/storyboard-references',
      filter: ['*.png', '*.jpg', '*.jpeg'],
    },
  ],
};
