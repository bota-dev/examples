// Inspect the resolved Dart packages after a locked pub install. No network or extra dependencies.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = resolve(fileURLToPath(new URL('../flutter/', import.meta.url)));
const configFile = join(project, '.dart_tool/package_config.json');
const config = JSON.parse(readFileSync(configFile, 'utf8'));
if (config.configVersion !== 2 || !Array.isArray(config.packages) || !config.packages.length)
  throw new Error('Run flutter pub get --enforce-lockfile before the license gate.');

const licenses = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'];
const sdkPackages = new Set(['flutter', 'flutter_test', 'flutter_web_plugins', 'sky_engine']);
const checked = new Set();
let dependencies = 0;
for (const pkg of config.packages) {
  if (typeof pkg.name !== 'string' || checked.has(pkg.name) || typeof pkg.rootUri !== 'string')
    throw new Error('Invalid resolved package metadata.');
  checked.add(pkg.name);
  const uri = new URL(pkg.rootUri, pathToFileURL(configFile));
  if (uri.protocol !== 'file:') throw new Error(`Unsupported package source: ${pkg.name}`);
  const root = resolve(fileURLToPath(uri));
  if (root === project) continue; // Bota-authored sample is covered by the repository MIT license.
  dependencies += 1;
  let license = licenses.map(name => join(root, name)).find(existsSync);
  if (!license && sdkPackages.has(pkg.name) && basename(root) === pkg.name) {
    // Flutter SDK packages use the framework's BSD license. Do not search arbitrary ancestors.
    const framework = pkg.name === 'sky_engine'
      ? resolve(root, '../../../..') : resolve(root, '../..');
    if (existsSync(join(framework, 'bin/flutter')) || existsSync(join(framework, 'bin/flutter.bat')))
      license = join(framework, 'LICENSE');
  }
  if (!license || !existsSync(license)) throw new Error(`Missing dependency license: ${pkg.name}`);
  const text = readFileSync(license, 'utf8');
  if (/GNU (?:AFFERO |LESSER |LIBRARY )?GENERAL PUBLIC LICENSE|\b(?:A?GPL|LGPL|SSPL|BUSL|EUPL|OSL|EPL|MPL)[- ]\d|\bCC[- ]BY[- ](?:NC|ND|SA)\b|Creative Commons[\s\S]{0,100}(?:Non.?Commercial|No.?Derivatives|Share.?Alike)|Mozilla Public License|Eclipse Public License|Business Source License/i.test(text))
    throw new Error(`Forbidden dependency license: ${pkg.name}`);
  const permissive = /Permission is hereby granted, free of charge/i.test(text)
    || (/Redistribution and use in source and binary forms/i.test(text)
      && /THIS SOFTWARE IS PROVIDED/i.test(text))
    || (/Apache License/i.test(text) && /Version 2\.0/i.test(text));
  if (!permissive) throw new Error(`Unrecognized or forbidden dependency license: ${pkg.name}`);
}
console.log(`Flutter license gate: ${dependencies} resolved dependencies have MIT/BSD/Apache license text.`);
