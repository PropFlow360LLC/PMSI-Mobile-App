import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
mkdirSync(publicDir, { recursive: true });

const svgIcon = (size, maskable = false) => {
  const pad = maskable ? Math.round(size * 0.1) : 0;
  const inner = size - pad * 2;
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? size * 0.2 : size * 0.12}" fill="#008800"/>
  <rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${maskable ? inner * 0.15 : inner * 0.1}" fill="#0a0e27"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
    font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="${inner * 0.32}" fill="#00FF00">PMSI</text>
</svg>`);
};

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#008800"/>
  <text x="16" y="18" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="10" fill="#fff">P</text>
</svg>`;

async function png(name, size, maskable = false) {
  await sharp(svgIcon(size, maskable)).png().toFile(join(publicDir, name));
  console.log('Wrote', name);
}

await png('icon-192.png', 192);
await png('icon-512.png', 512);
await png('icon-maskable-192.png', 192, true);
await png('icon-maskable-512.png', 512, true);
await sharp(svgIcon(180)).png().toFile(join(publicDir, 'apple-touch-icon.png'));
console.log('Wrote apple-touch-icon.png');

writeFileSync(join(publicDir, 'favicon.svg'), faviconSvg);
console.log('Wrote favicon.svg');
