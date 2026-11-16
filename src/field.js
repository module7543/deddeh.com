// One scene: a ruled, softly lit floor and a sheet of blocks standing on it.
// Each section re-typesets the same blocks: a ruled sheet, prose with marginalia,
// code, a postcard. The floor's light takes the section's colour.
import {
  BoxGeometry, BufferAttribute, Color, Group, InstancedMesh, LinearSRGBColorSpace, Matrix4, Mesh,
  MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { gsap } from 'gsap';

const W = 100, ROWS = 14, COLS = 10, PITCH = 5.4, BLOCK_H = 2.5, BLOCK_Z = 1;
const N = ROWS * COLS + 1, CURSOR = N - 1;
const C = { slab: 0x3a3630, text: 0x8f8879, ink: 0xece6d8, dim: 0x4a463f, orange: 0xdd7d45, blue: 0x6f9fe0, green: 0x86b890, teal: 0x4fa7a0, violet: 0xa898dc };
const rowY = (r) => ((ROWS - 1) / 2 - r) * PITCH;
const LEFT = -W / 2;

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blank() {
  const out = [];
  const w = W / COLS;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) out.push({ x: LEFT + (c + .5) * w, y: rowY(r), w, z: 0, c: C.slab });
  out.push({ x: LEFT + 1.3, y: rowY(0), w: 2.6, z: 1.6, c: C.orange });
  return out;
}
const hide = (base, i) => ({ ...base[i], w: 0, z: 0 });

function writing() {
  const base = blank(), out = [], rand = rng(11);
  const limits = [.4, 0, .78, .78, .78, .78, .46, 0, .78, .78, .78, .78, .78, .28];
  const margin = { 3: [9, C.teal], 4: [6, C.text], 9: [11, C.orange], 10: [8, C.text], 11: [5, C.text] };
  let end = { x: LEFT, y: rowY(ROWS - 1) };
  for (let r = 0; r < ROWS; r++) {
    let x = LEFT;
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (c === COLS - 1 && margin[r]) { // a note in the margin, raised off the sheet
        const [w, color] = margin[r];
        out.push({ x: LEFT + W * .86 + w / 2, y: rowY(r), w, z: 3.2, c: color });
        continue;
      }
      const w = r === 0 ? 9 + rand() * 9 : 4 + rand() * 9.5;
      if (c === COLS - 1 || x + w > LEFT + W * limits[r] + .01) { out.push(hide(base, i)); continue; }
      const roll = rand();
      const color = r === 0 ? C.ink : roll < .13 ? C.blue : roll < .16 ? C.violet : C.text;
      out.push({ x: x + w / 2, y: rowY(r), w, z: 0, c: color });
      x += w + 1.5;
      if (r === ROWS - 1) end = { x, y: rowY(r) };
    }
  }
  out.push({ x: end.x + 1.3, y: end.y, w: 2.6, z: 1.6, c: C.orange });
  return out;
}

function projects() {
  const base = blank(), out = [], rand = rng(29);
  const indent = [0, 1, 1, 2, 2, 3, 3, 2, 2, 1, -1, 0, 1, 0];
  let end = { x: LEFT, y: 0 };
  for (let r = 0; r < ROWS; r++) {
    const added = r >= 4 && r <= 7;
    out.push({ x: LEFT + 1.3, y: rowY(r), w: 2.6, z: 0, c: added ? C.green : C.dim });
    let x = LEFT + 8 + Math.max(indent[r], 0) * 7;
    const tokens = indent[r] < 0 ? 0 : 2 + Math.floor(rand() * 4.6);
    for (let c = 1; c < COLS; c++) {
      const i = r * COLS + c;
      if (c > tokens) { out.push(hide(base, i)); continue; }
      const w = 4.5 + rand() * 11;
      const roll = rand();
      const color = added ? (roll < .2 ? C.ink : C.green) : c === 1 && roll < .7 ? C.blue : roll < .12 ? C.violet : roll < .22 ? C.orange : C.text;
      out.push({ x: x + w / 2, y: rowY(r), w, z: added ? .8 : 0, c: color });
      x += w + 1.5;
      if (r === 7) end = { x, y: rowY(r) };
    }
  }
  out.push({ x: end.x + 1.3, y: end.y, w: 2.6, z: 2.2, c: C.orange });
  return out;
}

// A postcard: message on the left, a divider, then stamp, postmark and address lines.
function contact() {
  const base = blank(), rand = rng(41);
  const out = base.map((b, i) => (i < COLS || i >= (ROWS - 1) * COLS ? { ...b, c: C.dim } : hide(base, i)));
  const put = (r, c, x, w, color, z = 0) => { out[r * COLS + c] = { x: x + w / 2, y: rowY(r), w, z, c: color }; return x + w + 1.5; };
  const message = { 2: [.2], 4: [.44], 5: [.44], 6: [.44], 7: [.3], 9: [.16], 10: [.24] };
  let end = { x: LEFT, y: rowY(10) };
  for (let r = 1; r < ROWS - 1; r++) {
    put(r, 5, -.7, 1.4, C.dim);
    if (!message[r]) continue;
    let x = LEFT + 3;
    for (let c = 0; c < 5; c++) {
      const w = r === 2 || r >= 9 ? 9 + rand() * 6 : 4.5 + rand() * 8;
      if (x + w > LEFT + W * message[r][0] + 3) break;
      x = put(r, c, x, w, r === 2 ? C.ink : r === 10 ? C.blue : C.text, r === 10 ? 1.2 : 0);
      if (r === 10) end = { x, y: rowY(r) };
    }
  }
  put(2, 9, 38, 8, C.orange, 2.6); put(3, 9, 38, 8, C.orange, 2.6); // the stamp
  put(2, 8, 22, 12, C.teal, .7); put(3, 8, 25, 12, C.teal, .7); put(4, 8, 22, 12, C.teal, .7); // the postmark
  put(7, 6, 8, 22, C.ink); put(7, 7, 31.5, 9, C.text);
  put(9, 6, 8, 30, C.text);
  put(11, 6, 8, 14, C.text); put(11, 7, 23.5, 7, C.text);
  out[CURSOR] = { x: end.x + 1.3, y: end.y, w: 2.6, z: 1.4, c: C.orange };
  return out;
}

// The name, set on the sheet's own rows and broken where it is spoken: DED / DEH.
// A letter is seven scanlines of runs, drawn heavy enough to join into strokes.
const LINES = ['DED', 'DEH'], SCANS = ROWS / LINES.length, GLYPH = 25, GAP = 5.5, STEM = 7.8, SCAN = 4.75, LINE = 4;
const INSET = 3, letterX = (n) => LEFT + INSET + n * (GLYPH + GAP);
const scanY = (r) => (r < SCANS ? 1 : -1) * (ROWS * PITCH) / 2 - (r < SCANS ? 1 : -1) * LINE / 2 - (r < SCANS ? r : r - ROWS + 1) * SCAN;
function runs(letter, k) {
  const edge = k === 0 || k === SCANS - 1, bar = k === (SCANS - 1) / 2, stems = [[0, STEM], [GLYPH - STEM, STEM]];
  if (letter === 'D') return edge ? [[0, GLYPH - 5]] : stems;
  if (letter === 'E') return edge ? [[0, GLYPH - 2]] : bar ? [[0, GLYPH - 7]] : [[0, STEM]];
  return bar ? [[0, GLYPH]] : stems; // H
}
function name() {
  const base = blank(), out = [];
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    [...LINES[Math.floor(r / SCANS)]].forEach((letter, n) => {
      for (const [x, w] of runs(letter, r % SCANS)) { out.push({ x: letterX(n) + x + w / 2, y: scanY(r), w, h: LINE, z: 0, c: C.text }); c++; }
    });
    for (; c < COLS; c++) out.push({ ...hide(base, r * COLS + c), y: scanY(r) });
  }
  out.push({ x: letterX(3) + 1.3, y: scanY(ROWS - 1), w: 2.6, z: 1.6, c: C.orange });
  return out;
}

// The same name read as a number. DEDDE is hexadecimal (the h is how assembly marks it):
// one row a digit, four bits a row, high bit first. A raised block is a one.
function bits() {
  const out = name().map((b) => ({ ...b, w: 0, z: 0 }));
  const digits = [...LINES.join('')].slice(0, -1), step = (ROWS * PITCH) / digits.length, w = 18.5, h = 10.5, pitch = w + 3.5;
  digits.forEach((digit, i) => {
    const value = parseInt(digit, 16), y = ((digits.length - 1) / 2 - i) * step;
    for (let j = 0; j < 4; j++) {
      const on = (value >> (3 - j)) & 1;
      out[(1 + i * 3) * COLS + j] = { x: LEFT + INSET + j * pitch + w / 2, y, w, h, z: on ? 4.5 : 0, c: on ? C.ink : C.slab };
    }
  });
  out[CURSOR] = { x: LEFT + INSET + 4 * pitch + 1.3, y: -2 * step - h / 2 + BLOCK_H / 2, w: 2.6, z: 1.6, c: C.orange }; // the h
  return out;
}

// Projects holds two collections, and the sheet is set once more for each.
// Apps: a window. A title bar, a sidebar, a heading, three tiles and a chart.
function apps() {
  const base = blank(), out = base.map((b, i) => hide(base, i));
  let n = 0;
  const put = (x, r, w, c, z = 0, h = BLOCK_H, dy = 0) => { out[n++] = { x: x + w / 2, y: rowY(r) + dy, w, h, z, c }; return x + w + 1.5; };
  [C.orange, C.dim, C.dim].forEach((c, i) => put(LEFT + i * 4.1, 0, 2.6, c));
  put(put(LEFT + 26, 0, 34, C.dim), 0, 11, C.dim); put(LEFT + 91, 0, 9, C.dim);
  [14, 10, 16, 12, 9, 15, 11, 13, 8, 12].forEach((w, i) => put(LEFT, i + 2, w, i === 2 ? C.green : C.text, i === 2 ? .9 : 0));
  put(LEFT, 13, 18, C.dim);
  const x0 = LEFT + 26, end = put(put(x0, 2, 21, C.ink), 2, 12, C.ink);
  [9, 14, 7, 11, 6].reduce((x, w) => put(x, 3, w, C.text), x0);
  [C.green, C.teal, C.blue].forEach((c, i) => put(x0 + i * 25.5, 5, 23, c, i ? .5 : 1.4, PITCH + BLOCK_H, -PITCH / 2));
  put(put(x0, 8, 12, C.text), 8, 6, C.text);
  const floor = rowY(13) - BLOCK_H / 2;
  [1.6, 2.4, 1.2, 3.1, 2.6, 3.7, 2.1, 3.3, 4.2].forEach((rows, i) => {
    const h = rows * PITCH - (PITCH - BLOCK_H);
    out[n++] = { x: x0 + i * 8.3 + 3, y: floor + h / 2, w: 6, h, z: i === 8 ? 1 : .3, c: i === 8 ? C.ink : C.green };
  });
  out[CURSOR] = { x: end + 1.3, y: rowY(2), w: 2.6, z: 1.8, c: C.orange };
  return out;
}

// Music: a score, as a piano roll. Keys down the left edge, a melody above a slower line.
// Each track is given its own (the seed), and the cursor is its playhead.
export const SCORE_X = LEFT + 10, SCORE_W = W / 2 - SCORE_X;
const KEYS = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0];
export function score(seed = 7) {
  const base = blank(), out = base.map((b, i) => hide(base, i)), rand = rng(seed), notes = [];
  let n = 0;
  KEYS.forEach((white, r) => { out[n++] = { x: LEFT + (white ? 3 : 2), y: rowY(r), w: white ? 6 : 4, z: 0, c: white ? C.text : C.dim }; });
  const voice = (low, high, short, long, rests, tone) => {
    let x = SCORE_X, row = low + Math.floor(rand() * (high - low + 1));
    while (x < W / 2 - 2 && n < CURSOR - 1) {
      const w = Math.min(short + rand() * (long - short), W / 2 - x);
      if (rand() < rests) { x += w * .6; continue; }
      row = Math.min(Math.max(row + Math.round((rand() - .5) * (tone ? 5 : 3)), low), high);
      const c = tone ? (rand() < .2 ? C.ink : C.violet) : C.text;
      out[n++] = { x: x + w / 2, y: rowY(row), w, z: tone ? .9 : 0, c };
      notes.push({ at: (x - SCORE_X) / SCORE_W, for: w / SCORE_W, row });
      x += w + .9;
    }
  };
  voice(1, 8, 2.6, 9, .13, true);
  voice(10, 13, 9, 20, .06, false);
  out[CURSOR] = { x: SCORE_X - 2.2, y: rowY(0), w: 2.6, z: 1.6, c: C.orange };
  out.notes = notes;
  return out;
}

// Seven broad frequency bands across twenty moments in the actual recording.
// This is a spectral relief, deliberately without piano keys or implied pitches.
export function spectralSheet(data) {
  const out = [];
  const palette = [C.orange, C.text, C.ink, C.violet, C.violet, C.blue, C.teal];
  for (let band = 0; band < 7; band++) for (let column = 0; column < 20; column++) {
    const energy = data.overview[column][band + 2] / 255;
    out.push({ x: SCORE_X + (column + .5) * SCORE_W / 20,
      y: rowY(12.5 - band * 2), w: SCORE_W / 20 * (.24 + energy * .64),
      h: 1.1 + energy * 3.3, z: energy ** 2 * 9, c: palette[band], band, energy });
  }
  out.push({ x: SCORE_X, y: 0, w: .65, h: ROWS * PITCH, z: 1.6, c: C.orange });
  out.spectral = true;
  return out;
}

const FORMATIONS = { blank: blank(), name: name(), bits: bits(), writing: writing(), projects: projects(), contact: contact(), apps: apps(), music: score() };
const SPIN = { blank: -.4, name: -.4, bits: -.4, writing: -.34, projects: -.46, contact: -.3, card: 0, apps: -.46, music: -.36 };
const PITCH_X = -.98; // how far the sheet leans back when it is not laid flat
const raw = (hex) => new Color().setHex(hex, LinearSRGBColorSpace); // shader colours stay in display space
const TINT = { blank: raw(0x8a6a4c), name: raw(0x8a6a4c), bits: raw(0x8a6a4c), writing: raw(C.blue), projects: raw(C.green), contact: raw(C.orange), card: raw(C.orange), apps: raw(C.green), music: raw(C.violet) };

const FLOOR_VERTEX = `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const FLOOR_FRAGMENT = `
precision highp float;
uniform vec3 uBg, uTint, uPointer, uPaperCol, uGlow, uHead;
uniform vec2 uHalf;
uniform float uPaper, uMusic, uLive, uLow;
varying vec2 vP;
float rule(float v, float cell) {
  float d = abs(fract(v / cell + .5) - .5) * cell;
  return 1. - smoothstep(0., fwidth(v) * 1.2, d);
}
void main() {
  vec2 q = vP / vec2(80., 62.);
  float r2 = dot(q, q);
  float pool = exp(-r2 * .95), reach = exp(-r2 * .3);
  vec2 d = vP - uPointer.xy;
  float spot = uPointer.z * exp(-dot(d, d) / 1100.);
  float grid = max(rule(vP.y, ${PITCH.toFixed(2)}), rule(vP.x, ${(W / COLS).toFixed(2)}));
  // Music opens into a deeper, sparsely ruled field. The sculpture itself is unchanged.
  float architecture = max(rule(vP.y, ${(PITCH * 4).toFixed(2)}), rule(vP.x, ${(W / COLS * 4).toFixed(2)}));
  grid = mix(grid, architecture * .32, uMusic);
  // Preserve the recording-driven moving light independently of the floor pattern.
  float hx = vP.x - uHead.x;
  float beam = uHead.z * exp(-hx * hx / 150.) * exp(-vP.y * vP.y / (uHead.y * uHead.y * 1.6));
  vec3 ground = mix(uBg, vec3(.035, .085, .10), uMusic);
  vec3 col = ground * (.7 + .3 * reach);
  col += uTint * (.1 * pool * (1. + .9 * uLive) + .045 * spot);
  col += uGlow * beam * (.035 + .2 * uLow + .1 * uLive);
  col += mix(vec3(.93, .9, .85), uTint, .45) * grid * (.008 + .085 * reach * (1. + .5 * uLive) + .14 * spot + .1 * beam * (.3 + uLive));
  // The proof: the sheet's own rectangle turns to paper and grows until it is the page.
  vec2 e = abs(vP) - uHalf;
  float inside = 1. - smoothstep(0., max(fwidth(vP.x), fwidth(vP.y)) * 1.5, max(e.x, e.y));
  col = mix(col, uPaperCol, inside * uPaper);
  gl_FragColor = vec4(col, 1.);
}`;
const PAPER = 0xece6d8, SHADOW = 0x0b0a09, PAPER_SHADOW = 0xcfc7b5;
const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

export class Field {
  constructor(stage, slot, reducedMotion) {
    this.stage = stage; this.slot = slot; this.reduced = reducedMotion;
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.renderer.setClearColor(0x141311);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    stage.append(this.renderer.domElement);
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, -4000, 4000);
    this.group = new Group();
    this.group.rotation.set(PITCH_X, 0, SPIN.blank, 'XYZ');
    this.scene.add(this.group);

    // Flat, graphic shading baked into the box: bright top, two darker visible sides.
    const geometry = new BoxGeometry(1, 1, 1);
    const shade = new Float32Array(72);
    const normal = geometry.attributes.normal;
    for (let i = 0; i < 24; i++) {
      const s = normal.getZ(i) > .5 ? 1 : normal.getY(i) < -.5 ? .34 : normal.getX(i) > .5 ? .2 : .14;
      shade.set([s, s, s], i * 3);
    }
    geometry.setAttribute('color', new BufferAttribute(shade, 3));
    this.mesh = new InstancedMesh(geometry, new MeshBasicMaterial({ vertexColors: true }), N);
    this.mesh.frustumCulled = false;
    this.floor = new Mesh(new PlaneGeometry(8000, 8000), new ShaderMaterial({
      vertexShader: FLOOR_VERTEX, fragmentShader: FLOOR_FRAGMENT,
      uniforms: { uBg: { value: raw(0x141311) }, uTint: { value: TINT.blank.clone() }, uPointer: { value: new Vector3() }, uPaperCol: { value: raw(PAPER) }, uHalf: { value: new Vector2(W / 2 + 5, (ROWS * PITCH) / 2 + 5) }, uPaper: { value: 0 }, uMusic: { value: 0 }, uLive: { value: 0 }, uLow: { value: 0 }, uGlow: { value: raw(C.orange) }, uHead: { value: new Vector3(0, (ROWS * PITCH) / 2, 0) } },
    }));
    this.shadows = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: SHADOW }), N);
    this.shadows.frustumCulled = false;
    this.shadows.position.z = .04;
    this.group.add(this.floor, this.shadows, this.mesh);

    this.state = FORMATIONS.blank.map((b) => ({ ...b, h: BLOCK_H, col: new Color(b.c) }));
    this.from = this.state.map((b) => ({ ...b, col: b.col.clone() }));
    this.to = FORMATIONS.blank;
    this.formations = { ...FORMATIONS };
    this.toColors = Object.fromEntries(Object.entries(FORMATIONS).map(([k, f]) => [k, f.map((b) => new Color(b.c))]));
    this.flat = { v: 0 }; this.musicGround = { v: 0 }; this.home = { x: 0, y: 0 }; this.cardEl = null;
    this.name = 'blank';
    this.delay = FORMATIONS.blank.map((b) => ((b.x - LEFT) / W) * .45 + ((rowY(0) - b.y) / (PITCH * ROWS)) * .55);
    // The name and the number are set left to right, as if typed; everything else sweeps across the sheet.
    const typed = (f) => f.map((b, i) => (i === CURSOR ? 1 : Math.min(Math.max((b.x - LEFT) / W, 0), 1) * .86 + ((rowY(0) - b.y) / (PITCH * ROWS)) * .12));
    this.delays = { name: typed(FORMATIONS.name), bits: typed(FORMATIONS.name) };
    this.sweep = this.delay;
    this.off = new Color(C.slab);
    this.progress = { t: 1 };
    this.pointer = { x: 0, y: 0, power: 0, tiltX: 0, tiltY: 0 };
    this.moveX = gsap.quickTo(this.pointer, 'x', { duration: .35, ease: 'power3.out' });
    this.moveY = gsap.quickTo(this.pointer, 'y', { duration: .35, ease: 'power3.out' });
    this.matrix = new Matrix4(); this.color = new Color(); this.hi = new Color(C.ink);
    this.inverse = new Matrix4(); this.origin = new Vector3(); this.dir = new Vector3();
    this.time = 0; this.visible = true; this.dirty = true; this.head = null;

    this.onPointer = (event) => this.point(event.clientX, event.clientY, event.pointerType);
    this.onLeave = () => gsap.to(this.pointer, { power: 0, tiltX: 0, tiltY: 0, duration: .9, ease: 'power2.out' });
    this.onResize = () => this.resize();
    this.onScroll = () => { if (this.to.spectral) this.positionSlot(); };
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.onVisibility = () => { this.visible = !document.hidden; };
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    window.addEventListener('pointerdown', this.onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', this.onLeave);
    window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') this.onLeave(); }, { passive: true });
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.observer = new ResizeObserver(this.onResize);
    this.observer.observe(slot);
    this.resize();
    this.tick = (time, delta) => this.frame(delta);
    gsap.ticker.add(this.tick);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    Object.assign(this.camera, { left: -w / 2, right: w / 2, top: h / 2, bottom: -h / 2 });
    this.camera.updateProjectionMatrix();
    this.positionSlot();
  }

  positionSlot() {
    const w = window.innerWidth, h = window.innerHeight;
    const slot = this.slot.getBoundingClientRect();
    const narrow = w <= 820;
    const scale = narrow ? Math.min((w * .84) / W, (slot.height * 1.3) / (ROWS * PITCH * .62)) : Math.min((slot.width * 1.04) / W, (h * .95) / (ROWS * PITCH * .62));
    this.fit = scale * (this.to?.spectral ? (narrow ? .84 : .88) : 1);
    if (!gsap.isTweening(this.group.scale)) this.group.scale.setScalar(this.fit);
    const cx = narrow ? w * .5 : slot.left + slot.width * .5;
    const cy = slot.top + slot.height * (narrow ? .56 : .41);
    // A plate stands right of the sheet's centre (its start line is at SCORE_X), so it is brought back to the slot's.
    const off = this.to?.spectral ? (SCORE_X + SCORE_W / 2) * this.fit : 0;
    this.rest = { x: cx - w / 2 - off * Math.cos(SPIN.music), y: h / 2 - cy - off * Math.sin(SPIN.music) * Math.cos(PITCH_X) };
    if (!gsap.isTweening(this.home)) Object.assign(this.home, this.rest);
    this.dirty = true;
  }

  point(clientX, clientY, type) {
    const w = window.innerWidth, h = window.innerHeight;
    this.group.updateMatrixWorld();
    this.inverse.copy(this.group.matrixWorld).invert();
    this.origin.set(clientX - w / 2, h / 2 - clientY, 2000).applyMatrix4(this.inverse);
    this.dir.set(0, 0, -1).transformDirection(this.inverse);
    const t = -this.origin.z / this.dir.z;
    this.moveX(this.origin.x + this.dir.x * t);
    this.moveY(this.origin.y + this.dir.y * t);
    const tilt = this.reduced || type !== 'mouse' ? 0 : 1;
    gsap.to(this.pointer, { power: 1, tiltX: (clientY / h - .5) * .07 * tilt, tiltY: (clientX / w - .5) * .1 * tilt, duration: .6, ease: 'power2.out', overwrite: 'auto' });
  }

  select(name = 'blank', duration = 1.15, wait = 0) {
    if (name === this.name && name !== 'card') return;
    const changed = name !== this.name;
    this.name = name;
    this.state.forEach((s, i) => { Object.assign(this.from[i], { x: s.x, y: s.y, w: s.w, h: s.h, z: s.z }); this.from[i].col.copy(s.col); });
    const wasSpectral = Boolean(this.to.spectral);
    this.to = this.formations[name];
    if (wasSpectral !== Boolean(this.to.spectral)) this.resize();
    if (this.to.spectral) { gsap.killTweensOf(this.pointer); Object.assign(this.pointer, { power: 0, tiltX: 0, tiltY: 0 }); }
    this.delay = this.delays[name] ?? this.sweep;
    gsap.killTweensOf(this.progress);
    this.progress.t = 0;
    if (this.reduced) this.progress.t = 1;
    else gsap.to(this.progress, { t: 1, duration, delay: wait, ease: 'none' });
    this.dirty = true;
    if (!changed) return;
    const tint = this.floor.material.uniforms.uTint.value, to = TINT[name];
    gsap.to(tint, { r: to.r, g: to.g, b: to.b, duration: this.reduced ? 0 : 1.1, ease: 'power2.out', overwrite: 'auto' });
    gsap.to(this.group.rotation, { z: SPIN[name], duration: this.reduced ? 0 : 1.3, ease: 'power3.inOut', overwrite: 'auto' });
    gsap.to(this.flat, { v: name === 'card' ? 1 : 0, duration: this.reduced ? 0 : 1.2, ease: 'power3.inOut', overwrite: 'auto' });
    gsap.to(this.musicGround, { v: this.to.spectral || name === 'music' ? 1 : 0, duration: this.reduced ? 0 : 1.4, ease: 'power2.inOut', overwrite: 'auto' });
  }

  // Lay the sheet flat behind a DOM element and set the blocks from its parts.
  // Bars are in CSS pixels from the element's centre (y down); they follow it as it scrolls.
  card(element, bars, cursor, duration) {
    const unit = 1 / this.group.scale.x, base = this.formations.blank;
    const place = (bar) => ({ x: bar.x * unit, y: -bar.y * unit, w: bar.w * unit, h: bar.h * unit, z: bar.z ?? 0, c: bar.c });
    const to = base.map((b, i) => (i < CURSOR && bars[i] ? place(bars[i]) : { ...b, w: 0, z: 0 }));
    if (cursor) to[CURSOR] = place(cursor);
    this.cardEl = element;
    this.formations.card = to;
    this.toColors.card = to.map((b) => new Color(b.c));
    this.select('card', duration ?? (this.name === 'card' ? .5 : 1.15));
  }

  // Pull a proof: the blocks lie flat as the lines of a page (bars, as for card()), and the sheet
  // beneath them turns to paper and grows to fill the window. Then the page itself takes over.
  proof(element, bars, done) {
    this.card(element, bars, null, .8);
    const u = this.floor.material.uniforms, unit = 1 / this.group.scale.x, to = TINT.writing, shadow = new Color(PAPER_SHADOW);
    gsap.to(u.uTint.value, { r: to.r, g: to.g, b: to.b, duration: .4, overwrite: true });
    gsap.to(this.flat, { v: 1, duration: .7, ease: 'power3.inOut', overwrite: true });
    gsap.to(this.group.rotation, { z: 0, duration: .7, ease: 'power3.inOut', overwrite: true });
    this.paper?.kill();
    u.uHalf.value.set(W / 2 + 5, (ROWS * PITCH) / 2 + 5);
    this.paper = gsap.timeline({ onComplete: done })
      .to(u.uPaper, { value: 1, duration: .25, ease: 'power1.out' }, .04)
      .to(this.shadows.material.color, { r: shadow.r, g: shadow.g, b: shadow.b, duration: .3 }, .04)
      .to(u.uHalf.value, { x: window.innerWidth * unit * .62, y: window.innerHeight * unit * .62, duration: .68, ease: 'power2.inOut' }, .08);
  }
  // Back from the page (the browser restored this one): the floor is dark again.
  unproof() {
    this.paper?.kill(); this.paper = null;
    this.floor.material.uniforms.uPaper.value = 0;
    this.shadows.material.color.setHex(SHADOW);
    this.dirty = true;
  }

  // A formation of the caller's own (a track's score), turned and lit like an existing one.
  define(name, formation, like) {
    this.formations[name] = formation;
    this.toColors[name] = formation.map((b) => new Color(b.c));
    SPIN[name] = SPIN[like]; TINT[name] = TINT[like];
    // A recording is set in the order it is heard: start to end, low band first.
    if (formation.spectral) this.delays[name] = formation.map((b, i) => (i === CURSOR ? 0 : Math.min(Math.max((b.x - SCORE_X) / SCORE_W, 0), 1) * .82 + b.band * .026));
  }
  has(name) { return Boolean(this.formations[name]); }
  // What the recording is like (see characterOf): the colour of the playhead's light runs from warm to cool with its spectral tilt.
  setCharacter(character) {
    const to = raw(C.orange).lerp(raw(C.teal), character ? Math.min(Math.max(.5 + character.tilt * 1.6, 0), 1) : 0);
    gsap.to(this.floor.material.uniforms.uGlow.value, { r: to.r, g: to.g, b: to.b, duration: this.reduced ? 0 : 1, overwrite: true, onUpdate: () => { this.dirty = true; } });
  }
  // The floor light, for a flat sheet that belongs to a section other than Contact.
  light(name) {
    const tint = this.floor.material.uniforms.uTint.value, to = TINT[name];
    gsap.to(tint, { r: to.r, g: to.g, b: to.b, duration: this.reduced ? 0 : .8, ease: 'power2.out', overwrite: true });
  }
  // The room's pages replace one another without a reload; the sheet follows whichever slot is on the page.
  setSlot(slot) {
    const from = { ...this.home }, size = this.group.scale.x, glide = this.to.spectral && !this.reduced && slot !== this.slot;
    this.observer.disconnect();
    this.slot = slot;
    this.observer.observe(slot);
    gsap.killTweensOf([this.home, this.group.scale]);
    this.resize();
    if (!glide) return;
    // Between Music's pages the plate does not jump: it crosses the floor to its new place.
    const settle = () => { Object.assign(this.home, this.rest); this.group.scale.setScalar(this.fit); this.dirty = true; };
    gsap.fromTo(this.home, from, { ...this.rest, duration: .9, ease: 'power3.inOut', onComplete: settle });
    gsap.fromTo(this.group.scale, { x: size, y: size, z: size }, { x: this.fit, y: this.fit, z: this.fit, duration: .9, ease: 'power3.inOut' });
  }
  // The playhead: a position along the score (0 to 1), or null for none. The cursor becomes a bar that crosses the sheet.
  setHead(position) {
    this.head = position === null ? null : SCORE_X + Math.min(Math.max(position, 0), 1) * SCORE_W;
    this.dirty = true;
  }

  setAudioFrame(frame) { this.audioFrame = frame; if (!this.reduced) this.dirty = true; }

  setReducedMotion(reduced) { this.reduced = reduced; this.dirty = true; }
  refresh() { this.dirty = true; }

  frame(delta) {
    if (!this.visible) return;
    const p = this.pointer;
    const moving = this.progress.t < 1 || p.power > .002 || gsap.isTweening(this.group.rotation) || gsap.isTweening(this.floor.material.uniforms.uTint.value) || gsap.isTweening(this.flat) || gsap.isTweening(this.musicGround) || gsap.isTweening(this.home) || Boolean(this.paper?.isActive());
    if ((this.reduced || this.to.spectral) && !moving && !this.dirty) return;
    this.dirty = false;
    this.time += delta / 1000;
    const colors = this.toColors[this.name];
    const spread = .8, T = this.progress.t * (1 + spread);
    const flat = this.flat.v, lean = 1 - flat;
    this.group.rotation.x = (PITCH_X + p.tiltX) * lean;
    this.group.rotation.y = p.tiltY * lean;
    let px = this.home.x, py = this.home.y;
    if (flat > 0 && this.cardEl) {
      const r = this.cardEl.getBoundingClientRect();
      px += (r.left + r.width / 2 - window.innerWidth / 2 - px) * flat;
      py += (window.innerHeight / 2 - (r.top + r.height / 2) - py) * flat;
    }
    this.group.position.set(px, py, 0);
    const u = this.floor.material.uniforms, heard = this.reduced ? null : this.audioFrame;
    u.uPointer.value.set(p.x, p.y, p.power);
    u.uMusic.value = this.musicGround.v;
    u.uLive.value = heard?.[0] ?? 0; u.uLow.value = heard?.[2] ?? 0;
    u.uHead.value.set(this.head ?? 0, (ROWS * PITCH) / 2, this.head !== null && this.to.spectral ? this.musicGround.v : 0);
    for (let i = 0; i < N; i++) {
      const a = this.from[i], b = this.to[i], s = this.state[i];
      const k = ease(Math.min(Math.max(T - this.delay[i] * spread, 0), 1));
      s.x = a.x + (b.x - a.x) * k; s.y = a.y + (b.y - a.y) * k;
      s.w = a.w + (b.w - a.w) * k; s.z = a.z + (b.z - a.z) * k;
      s.h = a.h + ((b.h ?? BLOCK_H) - a.h) * k;
      s.col.copy(a.col).lerp(colors[i], k);
      const dx = s.x - p.x, dy = s.y - p.y;
      const near = (this.to.spectral ? 0 : p.power) * Math.exp(-(dx * dx + dy * dy) / 330);
      const wave = this.reduced || this.to.spectral ? 0 : .22 * (1 + Math.sin(this.time * .7 + s.x * .06 - s.y * .11));
      const arc = Math.sin(k * Math.PI) * 2.2;
      let depth = BLOCK_Z + (near * 7 + wave) * (1 - flat * .7) + arc;
      this.color.copy(s.col).lerp(this.hi, near * .6);
      let bx = s.x, by = s.y, bw = s.w, bh = s.h;
      if (this.head !== null && k > .98) {
        if (i === CURSOR) { bx = this.head; by = 0; bw = .9; bh = ROWS * PITCH + 4; depth = BLOCK_Z + 1.2; }
        else if (s.x > SCORE_X - 1) { // the note under the playhead stands up
          const lit = Math.min(Math.max(1.6 - (Math.abs(s.x - this.head) - s.w / 2), 0), 1);
          if (this.to.spectral) {
            const energy = this.audioFrame?.[b.band + 2] ?? 0;
            const attack = this.audioFrame?.[1] ?? 0;
            const reach = Math.exp(-(((s.x - this.head) / 12) ** 2));
            // Under the playhead a band stands to its level; along the rest of its line it only stirs.
            if (!this.reduced) depth += energy * (reach * 10 + 1.5) + reach * attack * 2;
            this.color.lerp(this.hi, lit * .3 + (this.reduced ? 0 : (reach * .25 + .06) * energy));
          } else { depth += lit * 2.6; this.color.lerp(this.hi, lit * .55); }
        }
      }
      if (i === CURSOR && !this.reduced) this.color.lerp(this.off, (Math.sin(this.time * 3.2) > .2 ? 0 : .75) * (this.name === 'name' || this.name === 'bits' ? 1 : 0));
      const visible = bw > .06;
      if (!visible) depth = .001;
      this.matrix.makeScale(Math.max(bw, .001), visible ? bh : .001, depth);
      this.matrix.setPosition(bx, by, s.z + depth / 2);
      this.mesh.setMatrixAt(i, this.matrix);
      this.mesh.setColorAt(i, this.color);
      // The shadow runs from the block's footprint away from the light; taller and higher blocks cast further.
      const fall = visible ? (s.z + depth) * .62 : 0, lift = visible ? s.z * .62 : 0;
      this.matrix.makeScale(visible ? bw + fall - lift : .001, visible ? bh + fall - lift : .001, 1);
      this.matrix.setPosition(bx + (fall + lift) / 2, by - (fall + lift) / 2, 0);
      this.shadows.setMatrixAt(i, this.matrix);
    }
    this.shadows.instanceMatrix.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    gsap.ticker.remove(this.tick);
    window.removeEventListener('pointermove', this.onPointer);
    window.removeEventListener('pointerdown', this.onPointer);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('scroll', this.onScroll);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.observer.disconnect();
    for (const m of [this.mesh, this.shadows, this.floor]) { m.geometry.dispose(); m.material.dispose(); } this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
