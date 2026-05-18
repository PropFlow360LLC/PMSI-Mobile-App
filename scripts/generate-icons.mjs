import sharp from 'sharp';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const logoPath = join(publicDir, 'branding', 'pmsi-logo.png');

if (!existsSync(logoPath)) {
  console.error('Missing logo at public/branding/pmsi-logo.png');
  process.exit(1);
}

const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };

async function squareIcon(name, size, { maskable = false } = {}) {
  const pad = maskable ? Math.round(size * 0.12) : Math.round(size * 0.08);
  const inner = size - pad * 2;

  const logo = await sharp(logoPath)
    .resize(inner, inner, { fit: 'contain', background: BLACK })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BLACK,
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(join(publicDir, name));

  console.log('Wrote', name);
}

await squareIcon('icon-192.png', 192);
await squareIcon('icon-512.png', 512);
await squareIcon('icon-maskable-192.png', 192, { maskable: true });
await squareIcon('icon-maskable-512.png', 512, { maskable: true });
await squareIcon('apple-touch-icon.png', 180);

await sharp(logoPath)
  .resize(32, 32, { fit: 'contain', background: BLACK })
  .png()
  .toFile(join(publicDir, 'favicon-32.png'));
console.log('Wrote favicon-32.png');

await sharp(logoPath)
  .resize(16, 16, { fit: 'contain', background: BLACK })
  .png()
  .toFile(join(publicDir, 'favicon-16.png'));
console.log('Wrote favicon-16.png');
