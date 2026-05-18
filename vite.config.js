import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import express from 'express';
import { handleExtractAddress } from './server/extractAddress.js';
import { extractUpload } from './server/uploadMiddleware.js';

function extractAddressApiPlugin() {
  const api = express();
  api.use(express.json({ limit: '15mb' }));
  api.post('/extract-address', extractUpload.single('file'), handleExtractAddress);

  return {
    name: 'extract-address-api',
    configureServer(server) {
      server.middlewares.use('/api', api);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
  }

  return {
    plugins: [react(), extractAddressApiPlugin()],
    server: {
      port: 5173,
      host: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
