import { defineConfig } from 'vite';
import { build } from 'esbuild';

// `base: './'` deixa o build funcionar em qualquer subcaminho (ex.: GitHub Pages).
// JSX do Preact direto pelo esbuild do Vite, sem plugin.
export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: { target: 'es2020' },
  plugins: [serviceWorker()],
});

/** Empacota src/sw.js (que importa o banco e as regras dos lembretes) em dist/sw.js. */
function serviceWorker() {
  return {
    name: 'service-worker',
    apply: 'build',
    async generateBundle() {
      const out = await build({
        entryPoints: ['src/sw.js'], bundle: true, write: false, format: 'iife', target: 'es2020', minify: true,
      });
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: out.outputFiles[0].text });
    },
  };
}
