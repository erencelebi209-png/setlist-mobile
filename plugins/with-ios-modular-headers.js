const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function ensureUseModularHeaders(podfileContents) {
  if (podfileContents.includes('use_modular_headers!')) return podfileContents;

  const lines = podfileContents.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.trim().startsWith('platform :ios'));
  if (idx >= 0) {
    lines.splice(idx + 1, 0, 'use_modular_headers!');
    return lines.join('\n');
  }

  return ['use_modular_headers!', ...lines].join('\n');
}

module.exports = function withIosModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const podfilePath = path.join(iosRoot, 'Podfile');
      const raw = await fs.promises.readFile(podfilePath, 'utf8');
      const next = ensureUseModularHeaders(raw);
      if (next !== raw) {
        await fs.promises.writeFile(podfilePath, next, 'utf8');
      }
      return cfg;
    },
  ]);
};
