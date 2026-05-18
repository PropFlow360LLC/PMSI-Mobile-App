import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { handleExtractAddress } from './server/extractAddress.js';
import { extractUpload } from './server/uploadMiddleware.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));
app.post(
  '/api/extract-address',
  extractUpload.single('file'),
  handleExtractAddress
);

app.use(express.static(join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(join(__dirname, 'dist/index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`Server on ${PORT}`));
