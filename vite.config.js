import { defineConfig } from 'vite';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readReadingMode, applyReadingMode } from './src/reading-mode.js';

// Every folder under writing/ with an index.html is an essay with its own address.
const essays = readdirSync('writing', { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(`writing/${entry.name}/index.html`))
  .map((entry) => [`writing-${entry.name}`, `writing/${entry.name}/index.html`]);

// Every index.html under projects/ is a page of the Projects room: a collection, or one thing in it.
const rooms = readdirSync('projects', { withFileTypes: true, recursive: true })
  .filter((entry) => entry.isFile() && entry.name === 'index.html')
  .map((entry) => `${entry.parentPath}/index.html`.replaceAll('\\', '/'))
  .map((path) => [path.slice(0, -'/index.html'.length).replaceAll('/', '-'), path]);

export default defineConfig({
  base: './',
  plugins: [{
    name: 'writing-reading-preference',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        if (!/\/writing\/[^/]+\/index\.html$/.test(context.filename.replaceAll('\\', '/'))) return html;
        // Shared by current and future essays. Ordinary inline scripts run before module
        // downloads, including in the proof-measurement iframe. No JS means Paper.
        return [{ tag: 'style', children: readFileSync('src/reading-palette.css', 'utf8'), injectTo: 'head' },
          { tag: 'script', children: `(${applyReadingMode.toString()})((${readReadingMode.toString()})());`, injectTo: 'head' }];
      },
    },
  }],
  build: { target: 'es2022', rollupOptions: { input: { index: 'index.html', ...Object.fromEntries(essays), ...Object.fromEntries(rooms) } } },
});
