// Reuse the repository's local preview server; production hosting is untouched.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const target = 'artifacts/Deddeh-Paper-Ink-preview';
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync('dist', `${target}/deddeh.com`, { recursive: true });
const server = readFileSync('scripts/music-preview.py', 'utf8')
  .replace('/deddeh.com/projects/music/', '/deddeh.com/writing/the-margin/')
  .replace('Music V3 preview:', 'Paper / Ink preview:');
writeFileSync(`${target}/preview.py`, server);
writeFileSync(`${target}/START-HERE.txt`, `Deddeh.com — Paper / Ink\nSource commit: ${commit}\n\nRun: python3 preview.py (Windows: py preview.py)\nOpen http://127.0.0.1:4177/deddeh.com/writing/the-margin/\nUse --port 4178 if 4177 is occupied. Press Ctrl+C to stop.\n\nTry Paper / Ink in the header, scroll and switch again, reload, then return\nto Writing and reopen the essay to experience the proof in the saved mode.\n\nThis is the full bundled website with local fonts and audio. Nothing is\ndeployed. Contact retains its real destination: do not send a test message.\n`);
execFileSync('python3', ['-m', 'zipfile', '-c', `${target}.zip`, target]);
console.log(`${target}.zip — ${commit}`);
