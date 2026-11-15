import { defineConfig } from 'vite';
import { existsSync, readdirSync } from 'node:fs';

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
  build: { target: 'es2022', rollupOptions: { input: { index: 'index.html', ...Object.fromEntries(essays), ...Object.fromEntries(rooms) } } },
});
