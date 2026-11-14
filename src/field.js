// The sheet: one set of blocks standing in for unwritten text. Each section
// re-typesets the same blocks: ruled blank lines, paragraphs, code, loose notes.
import {
  BoxGeometry, BufferAttribute, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial,
  OrthographicCamera, Scene, Vector3, WebGLRenderer,
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
  const limits = [.42, 0, 1, 1, 1, 1, .58, 0, 1, 1, 1, 1, 1, .34];
  let end = { x: LEFT, y: rowY(ROWS - 1) };
  for (let r = 0; r < ROWS; r++) {
    let x = LEFT;
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const w = r === 0 ? 9 + rand() * 9 : 4 + rand() * 9.5;
      if (x + w > LEFT + W * limits[r] + .01) { out.push(hide(base, i)); continue; }
      const roll = rand();
      const color = r === 0 ? C.ink : roll < .13 ? C.blue : roll < .17 ? C.orange : C.text;
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

function notes() {
  const base = blank(), out = [], rand = rng(5);
  const cards = [
    { x: -50, r: 0, w: 30, lines: 3, z: 0, c: C.orange }, { x: -8, r: 1, w: 24, lines: 4, z: 5, c: C.teal },
    { x: 26, r: 0, w: 24, lines: 2, z: 0, c: C.ink }, { x: -44, r: 5, w: 22, lines: 4, z: 5, c: C.blue },
    { x: -12, r: 7, w: 34, lines: 3, z: 0, c: C.orange }, { x: 30, r: 4, w: 20, lines: 5, z: 9, c: C.teal },
    { x: -46, r: 11, w: 26, lines: 2, z: 0, c: C.ink }, { x: 22, r: 11, w: 28, lines: 3, z: 4, c: C.orange },
  ];
  let end = { x: 0, y: 0, z: 0 };
  for (const card of cards) {
    for (let l = 0; l < card.lines; l++) {
      let x = card.x;
      const count = l === 0 ? 1 : 1 + Math.floor(rand() * 2.6);
      for (let k = 0; k < count; k++) {
        const w = l === 0 ? card.w * (.45 + rand() * .3) : Math.min(card.x + card.w - x, 4 + rand() * 10);
        if (w < 2.5) break;
        out.push({ x: x + w / 2, y: rowY(card.r + l), w, z: card.z, c: l === 0 ? card.c : C.text });
        x += w + 1.5;
        end = { x, y: rowY(card.r + l), z: card.z };
      }
    }
  }
  while (out.length < CURSOR) out.push(hide(base, out.length));
  out.push({ x: end.x + 1.3, y: end.y, w: 2.6, z: end.z + 1.6, c: C.orange });
  return out;
}

const FORMATIONS = { blank: blank(), writing: writing(), projects: projects(), notes: notes() };
const SPIN = { blank: -.4, writing: -.34, projects: -.46, notes: -.28 };
const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

export class Field {
  constructor(stage, slot, reducedMotion) {
    this.stage = stage; this.slot = slot; this.reduced = reducedMotion;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    stage.append(this.renderer.domElement);
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, -4000, 4000);
    this.group = new Group();
    this.group.rotation.set(-.98, 0, SPIN.blank, 'XYZ');
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
    this.group.add(this.mesh);

    this.state = FORMATIONS.blank.map((b) => ({ ...b, col: new Color(b.c) }));
    this.from = this.state.map((b) => ({ ...b, col: b.col.clone() }));
    this.to = FORMATIONS.blank;
    this.toColors = Object.fromEntries(Object.entries(FORMATIONS).map(([k, f]) => [k, f.map((b) => new Color(b.c))]));
    this.name = 'blank';
    this.delay = FORMATIONS.blank.map((b) => ((b.x - LEFT) / W) * .45 + ((rowY(0) - b.y) / (PITCH * ROWS)) * .55);
    this.progress = { t: 1 };
    this.pointer = { x: 0, y: 0, power: 0, tiltX: 0, tiltY: 0 };
    this.moveX = gsap.quickTo(this.pointer, 'x', { duration: .35, ease: 'power3.out' });
    this.moveY = gsap.quickTo(this.pointer, 'y', { duration: .35, ease: 'power3.out' });
    this.matrix = new Matrix4(); this.color = new Color(); this.hi = new Color(C.ink);
    this.inverse = new Matrix4(); this.origin = new Vector3(); this.dir = new Vector3();
    this.time = 0; this.visible = true; this.dirty = true;

    this.onPointer = (event) => this.point(event.clientX, event.clientY, event.pointerType);
    this.onLeave = () => gsap.to(this.pointer, { power: 0, tiltX: 0, tiltY: 0, duration: .9, ease: 'power2.out' });
    this.onResize = () => this.resize();
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
    const slot = this.slot.getBoundingClientRect();
    const narrow = w <= 820;
    const scale = narrow ? Math.min((w * .9) / W, (slot.height * 1.25) / (ROWS * PITCH * .62)) : Math.min((slot.width * 1.75) / W, (h * .9) / (ROWS * PITCH * .62));
    this.group.scale.setScalar(scale);
    const cx = narrow ? w * .56 : slot.left + slot.width * .4;
    const cy = slot.top + slot.height * (narrow ? .6 : .58);
    this.group.position.set(cx - w / 2, h / 2 - cy, 0);
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

  select(name = 'blank') {
    if (name === this.name) return;
    this.name = name;
    this.state.forEach((s, i) => { Object.assign(this.from[i], { x: s.x, y: s.y, w: s.w, z: s.z }); this.from[i].col.copy(s.col); });
    this.to = FORMATIONS[name];
    gsap.killTweensOf(this.progress);
    this.progress.t = 0;
    if (this.reduced) this.progress.t = 1;
    else gsap.to(this.progress, { t: 1, duration: 1.15, ease: 'none' });
    gsap.to(this.group.rotation, { z: SPIN[name], duration: this.reduced ? 0 : 1.3, ease: 'power3.inOut', overwrite: 'auto' });
    this.dirty = true;
  }

  setReducedMotion(reduced) { this.reduced = reduced; this.dirty = true; }

  frame(delta) {
    if (!this.visible) return;
    const p = this.pointer;
    const moving = this.progress.t < 1 || p.power > .002 || gsap.isTweening(this.group.rotation);
    if (this.reduced && !moving && !this.dirty) return;
    this.dirty = false;
    this.time += delta / 1000;
    const colors = this.toColors[this.name];
    const spread = .8, T = this.progress.t * (1 + spread);
    this.group.rotation.x = -.98 + p.tiltX;
    this.group.rotation.y = p.tiltY;
    for (let i = 0; i < N; i++) {
      const a = this.from[i], b = this.to[i], s = this.state[i];
      const k = ease(Math.min(Math.max(T - this.delay[i] * spread, 0), 1));
      s.x = a.x + (b.x - a.x) * k; s.y = a.y + (b.y - a.y) * k;
      s.w = a.w + (b.w - a.w) * k; s.z = a.z + (b.z - a.z) * k;
      s.col.copy(a.col).lerp(colors[i], k);
      const dx = s.x - p.x, dy = s.y - p.y;
      const near = p.power * Math.exp(-(dx * dx + dy * dy) / 330);
      const wave = this.reduced ? 0 : .22 * (1 + Math.sin(this.time * .7 + s.x * .06 - s.y * .11));
      const arc = Math.sin(k * Math.PI) * 2.2;
      let depth = BLOCK_Z + near * 7 + wave + arc;
      this.color.copy(s.col).lerp(this.hi, near * .6);
      if (i === CURSOR && !this.reduced) this.color.lerp(colors[0], (Math.sin(this.time * 3.2) > .2 ? 0 : .75) * (this.name === 'blank' ? 1 : 0));
      const visible = s.w > .06;
      if (!visible) depth = .001;
      this.matrix.makeScale(Math.max(s.w, .001), visible ? BLOCK_H : .001, depth);
      this.matrix.setPosition(s.x, s.y, s.z + depth / 2);
      this.mesh.setMatrixAt(i, this.matrix);
      this.mesh.setColorAt(i, this.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    gsap.ticker.remove(this.tick);
    window.removeEventListener('pointermove', this.onPointer);
    window.removeEventListener('pointerdown', this.onPointer);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.observer.disconnect();
    this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
