const { getDefaultConfig } = require('expo/metro-config');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  config.resolver = {
    ...config.resolver,
    sourceExts: [...(config.resolver?.sourceExts ?? []), 'cjs'],
    unstable_enablePackageExports: false,
  };

  return config;
})();
