import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: true,
  splitting: false,
  outDir: 'dist',
  banner: {
    js: '#!/usr/bin/env node'
  }
});