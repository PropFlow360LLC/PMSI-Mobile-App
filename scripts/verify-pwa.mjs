import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');

const requiredIcons = [
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'favicon.svg',
];

const requiredFiles = ['manifest.json', 'sw.js', ...requiredIcons];

let failed = false;

for (const file of requiredFiles) {
  const path = join(publicDir, file);
  if (!existsSync(path)) {
    console.error('MISSING:', file);
    failed = true;
  } else {
    console.log('OK:', file);
  }
}

const manifest = JSON.parse(readFileSync(join(publicDir, 'manifest.json'), 'utf8'));
const requiredManifestFields = [
  'id',
  'name',
  'short_name',
  'start_url',
  'scope',
  'display',
  'theme_color',
  'background_color',
  'icons',
];

for (const field of requiredManifestFields) {
  if (manifest[field] == null) {
    console.error('manifest missing field:', field);
    failed = true;
  }
}

const has192 = manifest.icons?.some((i) => i.sizes === '192x192');
const has512 = manifest.icons?.some((i) => i.sizes === '512x512');
if (!has192 || !has512) {
  console.error('manifest must include 192x192 and 512x512 icons');
  failed = true;
}

if (manifest.display !== 'standalone') {
  console.error('manifest display should be standalone');
  failed = true;
}

const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const appleTags = [
  'apple-mobile-web-app-capable',
  'apple-mobile-web-app-status-bar-style',
  'apple-mobile-web-app-title',
  'apple-touch-icon',
  'rel="manifest"',
];

for (const tag of appleTags) {
  if (!indexHtml.includes(tag)) {
    console.error('index.html missing:', tag);
    failed = true;
  } else {
    console.log('OK index.html:', tag);
  }
}

if (failed) {
  console.error('\nPWA verification FAILED');
  process.exit(1);
}

console.log('\nPWA verification PASSED');
