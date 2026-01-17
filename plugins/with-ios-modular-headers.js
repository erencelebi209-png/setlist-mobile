const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function removeInjectedGlobalModularHeaders(podfileContents) {
  const lines = podfileContents.split(/\r?\n/);
  const filtered = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === 'use_modular_headers!') continue;
    filtered.push(line);
  }
  return filtered.join('\n');
}

function ensureSelectiveModularHeaders(podfileContents) {
  const lines = podfileContents.split(/\r?\n/);

  const targetIdx = lines.findIndex((l) => /\btarget\s+['"][^'"]+['"]\s+do\b/.test(l));
  if (targetIdx === -1) return podfileContents;

  const targetIndentMatch = lines[targetIdx].match(/^(\s*)/);
  const targetIndent = targetIndentMatch ? targetIndentMatch[1] : '';
  const podIndent = `${targetIndent}  `;

  const want = [
    `${podIndent}pod 'GoogleUtilities', :modular_headers => true`,
    `${podIndent}pod 'FirebaseCoreInternal', :modular_headers => true`,
  ];

  const toInsert = want.filter((w) => !podfileContents.includes(w.trim()));
  if (toInsert.length === 0) return podfileContents;

  lines.splice(targetIdx + 1, 0, ...toInsert);
  return lines.join('\n');
}

module.exports = function withIosModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const podfilePath = path.join(iosRoot, 'Podfile');
      const raw = await fs.promises.readFile(podfilePath, 'utf8');
      const withoutGlobal = removeInjectedGlobalModularHeaders(raw);
      const next = ensureSelectiveModularHeaders(withoutGlobal);
      if (next !== raw) {
        await fs.promises.writeFile(podfilePath, next, 'utf8');
      }
      return cfg;
    },
  ]);
};
