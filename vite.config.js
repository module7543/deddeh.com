import { defineConfig } from 'vite';
import { existsSync, readdirSync } from 'node:fs';

// Every folder under writing/ with an index.html is an essay with its own address.
const essays = readdirSync('writing', { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(`writing/${entry.name}/index.html`))
  .map((entry) => [`writing-${entry.name}`, `writing/${entry.name}/index.html`]);

export default defineConfig({
  base: './',
  build: { target: 'es2022', rollupOptions: { input: { index: 'index.html', ...Object.fromEntries(essays) } } },
});
