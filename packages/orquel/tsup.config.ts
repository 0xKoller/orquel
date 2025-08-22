import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    outDir: 'dist'
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: true,
    splitting: false,
    outDir: 'dist',
    banner: {
      js: '#!/usr/bin/env node'
    }
  },
  {
    entry: ['src/postinstall.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: true,
    splitting: false,
    outDir: 'dist'
  }
]);