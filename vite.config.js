import { defineConfig } from 'vite';

// `base: './'` deixa o build funcionar em qualquer subcaminho (ex.: GitHub Pages).
// JSX do Preact direto pelo esbuild do Vite, sem plugin.
export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: { target: 'es2020' },
});
