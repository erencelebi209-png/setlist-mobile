const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

function findGradleFile() {
  // Common locations
  const candidates = [
    path.join(projectRoot, 'node_modules', 'expo-firebase-core', 'android', 'build.gradle'),
    path.join(
      projectRoot,
      'node_modules',
      'expo-firebase-recaptcha',
      'node_modules',
      'expo-firebase-core',
      'android',
      'build.gradle',
    ),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  // Fallback: search node_modules (shallow)
  const nm = path.join(projectRoot, 'node_modules');
  if (!fs.existsSync(nm)) return null;

  const firstLevel = fs.readdirSync(nm, { withFileTypes: true });
  for (const entry of firstLevel) {
    if (!entry.isDirectory()) continue;
    // Direct match
    if (entry.name === 'expo-firebase-core') {
      const p = path.join(nm, entry.name, 'android', 'build.gradle');
      if (fs.existsSync(p)) return p;
    }

    // Nested node_modules match (one level deep)
    const nested = path.join(nm, entry.name, 'node_modules', 'expo-firebase-core', 'android', 'build.gradle');
    if (fs.existsSync(nested)) return nested;
  }

  return null;
}

function patch() {
  const gradlePath = findGradleFile();
  if (!gradlePath) {
    console.log('[patch-expo-firebase-core] build.gradle not found, skipping');
    return;
  }

  if (!fs.existsSync(gradlePath)) {
    console.log('[patch-expo-firebase-core] build.gradle not found, skipping');
    return;
  }

  const original = fs.readFileSync(gradlePath, 'utf8');
  let updated = original;
  let changed = false;

  // Fix 1: AGP requires compileSdk on library modules
  if (!updated.includes('compileSdkVersion')) {
    const needle = /android\s*\{\s*/;
    if (!needle.test(updated)) {
      console.log('[patch-expo-firebase-core] android { block not found, skipping');
      return;
    }

    updated = updated.replace(
      needle,
      (match) =>
        `${match}  if (rootProject.ext.has('compileSdkVersion')) {\n` +
        `    compileSdkVersion rootProject.ext.compileSdkVersion\n` +
        `  } else {\n` +
        `    compileSdkVersion 34\n` +
        `  }\n\n`,
    );
    changed = true;
  }

  // Fix 2: Gradle 8+ removed Jar.classifier in favor of archiveClassifier
  // Example failing line: classifier = 'sources'
  if (updated.includes('classifier')) {
    const before = updated;
    updated = updated.replace(/\bclassifier\s*=\s*(['"][^'"]+['"])/g, 'archiveClassifier.set($1)');
    if (updated !== before) changed = true;
  }

  if (!changed) {
    console.log('[patch-expo-firebase-core] nothing to patch, skipping');
    return;
  }

  fs.writeFileSync(gradlePath, updated, 'utf8');
  console.log('[patch-expo-firebase-core] patched build.gradle at', gradlePath);
}

try {
  patch();
} catch (e) {
  console.log('[patch-expo-firebase-core] failed', e);
  process.exitCode = 0;
}
