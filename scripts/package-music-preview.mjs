import { cp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

// Ship the actual Pages-path build, including audio/fonts, for an offline review.
// The server binds only to localhost. This does not deploy or change hosting.
const folder = 'artifacts/Deddeh-Music-V2-preview';
await rm(folder, { recursive: true, force: true });
await mkdir(folder, { recursive: true });
await cp('dist', `${folder}/deddeh.com`, { recursive: true });
await writeFile(`${folder}/preview.py`, `from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import webbrowser

class PreviewHandler(SimpleHTTPRequestHandler):
    # Browsers need byte ranges to seek in an MP3 before downloading all of it.
    def send_head(self):
        self.remaining = None
        path = Path(self.translate_path(self.path))
        requested = self.headers.get('Range')
        if not requested or not path.is_file():
            return super().send_head()
        size = path.stat().st_size
        match = re.fullmatch(r'bytes=(\\d*)-(\\d*)', requested)
        if not match or not any(match.groups()):
            self.send_error(416)
            return None
        left, right = match.groups()
        start = int(left) if left else max(0, size - int(right))
        end = min(int(right), size - 1) if left and right else size - 1
        if start > end or start >= size:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.end_headers()
            return None
        source = path.open('rb')
        source.seek(start)
        self.remaining = end - start + 1
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(str(path)))
        self.send_header('Content-Length', str(self.remaining))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Accept-Ranges', 'bytes')
        self.end_headers()
        return source

    def copyfile(self, source, output):
        if self.remaining is None:
            return super().copyfile(source, output)
        while self.remaining > 0:
            chunk = source.read(min(65536, self.remaining))
            if not chunk:
                break
            output.write(chunk)
            self.remaining -= len(chunk)

root = Path(__file__).resolve().parent
handler = partial(PreviewHandler, directory=str(root))
with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
    url = f'http://localhost:{server.server_port}/deddeh.com/projects/music/'
    print(f'Music V2 preview: {url}', flush=True)
    print('Press Ctrl+C to stop. No files are uploaded.', flush=True)
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
`);
await writeFile(`${folder}/README.txt`, `Deddeh.com — Music Art Direction V2

Unzip this folder, then run: python3 preview.py
On Windows: py preview.py
The local preview opens in your browser. Requires Python 3; no npm install.
Audio, fonts, and graphics are included. Nothing is deployed.

Try: collection > song > Play > seek > Pause > Read all lyrics > Music.
Resize the browser to review mobile. Audio never starts automatically.
The bundled site retains its existing Contact form; it is not a mock.

Source branch: design/music-art-direction-v2
Baseline: PR #9 at 0c6d16c715bedf2e2c6be5e930925db5e74ff395
`);
execFileSync('python3', ['-c', 'import shutil; shutil.make_archive("artifacts/Deddeh-Music-V2-preview", "zip", "artifacts", "Deddeh-Music-V2-preview")']);
console.log(`Interactive preview: ${folder}.zip`);
