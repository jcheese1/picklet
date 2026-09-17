import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  // GitHub Pages serves the site under /picklet/. Override with VITE_BASE=/ for other hosts.
  base: process.env.VITE_BASE ?? '/picklet/',
  plugins: [react()],
  server: {
    // The compiled models and evaluation reports live in ../dist.
    fs: { allow: [repoRoot] },
  },
});
