import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

// A portable preview: no server, CDN, account, or network requests required.
const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  write: false,
  outfile: 'preview.js',
  loader: { '.woff2': 'dataurl', '.woff': 'dataurl' },
  minify: true,
  target: 'es2022',
  legalComments: 'eof',
});
const javascript = result.outputFiles.find((file) => file.path.endsWith('.js')).text;
const css = result.outputFiles.find((file) => file.path.endsWith('.css')).text;
const icon = await readFile('public/favicon.svg', 'utf8');
let html = await readFile('index.html', 'utf8');
html = html.replace('</head>', () => `<style>${css}</style></head>`);
html = html.replace('./favicon.svg', `data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}`);
html = html.replace('<script type="module" src="/src/main.js"></script>', () => `<script>${javascript.replaceAll('</script', '<\\/script')}</script>`);
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/Deddeh-preview.html', html);
console.log('Portable preview: artifacts/Deddeh-preview.html');
