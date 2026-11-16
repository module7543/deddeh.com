// Package the existing Pages build. No hosting or deployment configuration changes.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const target = 'artifacts/Deddeh-Music-V3-preview';
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync('dist', `${target}/deddeh.com`, { recursive: true });
cpSync('scripts/music-preview.py', `${target}/preview.py`);
writeFileSync(`${target}/START-HERE.txt`, `Deddeh.com — Music V3\n\nRun: python3 preview.py (Windows: py preview.py)\nThen open http://127.0.0.1:4177/deddeh.com/projects/music/\n\nThe preview contains the full built website, bundled fonts, original MP3,\nanalysis and lyrics. It serves only on your own machine. Nothing is deployed.\nUse --port 4178 if 4177 is occupied. Press Ctrl+C to stop.\n\nReview Music, the recording, playback, seeking and the lyrics. The Contact\nform retains its real destination: do not send a test message.\n`);
execFileSync('python3', ['-m', 'zipfile', '-c', `${target}.zip`, target]);
console.log(`${target}.zip`);
