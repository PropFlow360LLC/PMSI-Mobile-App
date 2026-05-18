import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { handleExtractAddress } from './server/extractAddress.js';
import { extractUpload } from './server/uploadMiddleware.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'dist');
const app = express();
const PORT = process.env.PORT || 3000;

const noCache = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
};

app.use(express.json({ limit: '15mb' }));
app.post(
  '/api/extract-address',
  extractUpload.single('file'),
  handleExtractAddress
);

app.get('/sw.js', noCache, (_req, res) => {
  res.type('application/javascript');
  res.sendFile(join(distDir, 'sw.js'));
});

app.get('/manifest.json', noCache, (_req, res) => {
  res.type('application/manifest+json');
  res.sendFile(join(distDir, 'manifest.json'));
});

app.use(express.static(distDir, { maxAge: '1d', index: false }));
app.get('*', (_req, res) => res.sendFile(join(distDir, 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`Server on ${PORT}`));
