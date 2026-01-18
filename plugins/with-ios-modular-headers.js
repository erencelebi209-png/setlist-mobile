const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function hasPodDeclaration(podfileContents, podName) {
  const re = new RegExp(`^\\s*pod\\s+['\"]${podName}['\"]\\b`, 'm');
  return re.test(podfileContents);
}

function hasModularHeadersDeclaration(podfileContents, podName) {
  const re = new RegExp(
    `^\\s*pod\\s+['\"]${podName}['\"][^\\n]*:modular_headers\\s*=>\\s*true`,
    'm'
  );
  return re.test(podfileContents);
}

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

function ensureAllowNonModularIncludesInFrameworkModules(podfileContents) {
  if (podfileContents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
    return podfileContents;
  }

  const lines = podfileContents.split(/\r?\n/);
  const postInstallIdx = lines.findIndex((l) => /^\s*post_install\s+do\b/.test(l));
  if (postInstallIdx === -1) return podfileContents;

  const indentMatch = lines[postInstallIdx].match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : '';
  const i1 = `${indent}  `;
  const i2 = `${indent}    `;
  const i3 = `${indent}      `;
  const i4 = `${indent}        `;

  const snippet = [
    `${i1}installer.pods_project.targets.each do |t|`,
    `${i2}t.build_configurations.each do |config|`,
    `${i3}config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'`,
    `${i2}end`,
    `${i1}end`,
  ];

  lines.splice(postInstallIdx + 1, 0, ...snippet);
  return lines.join('\n');
}

function ensureSelectiveModularHeaders(podfileContents) {
  const lines = podfileContents.split(/\r?\n/);

  const targetIdx = lines.findIndex((l) => /\btarget\s+['"][^'"]+['"]\s+do\b/.test(l));
  if (targetIdx === -1) return podfileContents;

  const targetIndentMatch = lines[targetIdx].match(/^(\s*)/);
  const targetIndent = targetIndentMatch ? targetIndentMatch[1] : '';
  const podIndent = `${targetIndent}  `;

  const wantPods = [
    'GoogleUtilities',
    'FirebaseCore',
    'FirebaseCoreExtension',
    'FirebaseCoreInternal',
    'FirebaseAuthInterop',
    'FirebaseAppCheckInterop',
    'RecaptchaInterop',
    'FirebaseFirestoreInternal',
  ];

  const toInsert = wantPods
    .filter((podName) => !hasModularHeadersDeclaration(podfileContents, podName))
    .filter((podName) => !hasPodDeclaration(podfileContents, podName))
    .map((podName) => `${podIndent}pod '${podName}', :modular_headers => true`);
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
      const withAllowNonModular = ensureAllowNonModularIncludesInFrameworkModules(withoutGlobal);
      const next = ensureSelectiveModularHeaders(withAllowNonModular);
      if (next !== raw) {
        await fs.promises.writeFile(podfilePath, next, 'utf8');
      }
      return cfg;
    },
  ]);
};
