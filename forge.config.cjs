const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  outDir: 'dist',
  packagerConfig: {
    asar: true,
    icon: 'resources/icon',
    osxSign: {
      identity: process.env.APPLE_IDENTITY || 'Developer ID Application',
      hardenedRuntime: true,
      entitlements: 'build/entitlements.mac.plist',
      'entitlements-inherit': 'build/entitlements.mac.inherit.plist',
    },
    ...(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID
      ? {
          osxNotarize: {
            appleId: process.env.APPLE_ID,
            appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
            teamId: process.env.APPLE_TEAM_ID,
          },
        }
      : {}),
    ignore: (filePath) => {
      // Always include these essential directories/files
      if (!filePath) return false;
      if (filePath.startsWith('/out')) return false;
      if (filePath.startsWith('/node_modules')) return false;
      if (filePath === '/package.json') return false;
      
      // Ignore everything else at the root level
      if (filePath.startsWith('/src')) return true;
      if (filePath.startsWith('/electron')) return true;
      if (filePath.startsWith('/.git')) return true;
      if (filePath.startsWith('/.vscode')) return true;
      if (filePath.startsWith('/.idea')) return true;
      if (filePath.startsWith('/dist')) return true;
      if (filePath.startsWith('/resources')) return true;
      if (filePath.includes('.gitignore')) return true;
      if (filePath.includes('tsconfig')) return true;
      if (filePath.includes('vite.config')) return true;
      if (filePath.includes('electron.vite.config')) return true;
      if (filePath.includes('tailwind.config')) return true;
      if (filePath.includes('postcss.config')) return true;
      if (filePath.includes('README.md')) return true;
      if (filePath.includes('.eslintrc')) return true;
      if (filePath.includes('forge.config')) return true;
      
      return false;
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
