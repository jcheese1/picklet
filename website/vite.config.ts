import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    // The compiled models and evaluation reports live in ../dist.
    fs: { allow: [repoRoot] },
  },
});
