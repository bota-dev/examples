import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const require = createRequire(import.meta.url);
test('installed React and native renderer match the selected Expo runtime cohort', () => {
  const pkg = json('./package.json');
  const cohort = require('expo/bundledNativeModules.json');
  for (const name of ['react', 'react-native']) {
    assert.equal(pkg.dependencies[name], cohort[name]);
    assert.equal(require(`${name}/package.json`).version, cohort[name]);
  }
});
test('iOS cloud host has a reproducible config and no invented encrypted native module', () => {
  const config = json('./app.json').expo;
  assert.deepEqual(config.platforms, ['android', 'ios']);
  assert.equal(config.ios.bundleIdentifier, config.android.package);
  assert.equal(config.ios.infoPlist.NSBluetoothAlwaysUsageDescription, undefined);
  const audio = config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-audio')[1];
  assert.equal(audio.microphonePermission, false); assert.equal(audio.recordAudioAndroid, false);
  assert.equal(audio.enableBackgroundPlayback, false); assert.equal(audio.enableBackgroundRecording, false);
  assert.deepEqual(json('./modules/recording-sync/expo-module.config.json').platforms, ['android']);
});
test('native media dependencies match Expo57 and both original SDK identities agree', () => {
  const pkg = json('./package.json'), lock = json('./package-lock.json');
  for (const name of ['expo-audio', 'expo-document-picker', 'expo-file-system', 'expo-asset', 'expo-constants']) {
    assert.match(pkg.dependencies[name], /^57\.0\.\d+$/); assert.equal(lock.packages[`node_modules/${name}`].version, pkg.dependencies[name]);
  }
  assert.equal(pkg.dependencies['@bota.dev/react-native-app-sdk'], '2.0.0-beta.19');
  assert.equal(lock.packages['node_modules/@bota.dev/react-native-app-sdk'].version, pkg.dependencies['@bota.dev/react-native-app-sdk']);
  assert.ok(readFileSync(new URL('./modules/recording-sync/android/build.gradle', import.meta.url), 'utf8').includes(`dev.bota:bota-app-sdk:${pkg.dependencies['@bota.dev/react-native-app-sdk']}`));
  assert.equal(pkg.scripts['prebuild:ios'], 'expo prebuild --platform ios --no-install');
  assert.match(pkg.scripts['export:ios'], /--platform ios/);
});
