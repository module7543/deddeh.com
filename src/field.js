// One scene: a ruled, softly lit floor and a sheet of blocks standing on it.
// Each section re-typesets the same blocks: a ruled sheet, prose with marginalia,
// code, a postcard. The floor's light takes the section's colour.
import {
  BoxGeometry, BufferAttribute, Color, Group, InstancedMesh, LinearSRGBColorSpace, Matrix4, Mesh,
  MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector3, WebGLRenderer,
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

// The paper's watermark: a D, four cells wide and eight rows tall, in the middle of the ruled sheet.
// Nothing marks it at rest. Like any watermark it shows only against the light, which here is the pointer.
export const WATERMARK = Array.from({ length: N }, (_, i) => {
  const r = Math.floor(i / COLS) - 3, c = (i % COLS) - 3;
  if (i === CURSOR || r < 0 || r > 7 || c < 0 || c > 3) return 0;
  return c === 0 || (c === 3 ? r > 0 && r < 7 : r === 0 || r === 7) ? 1 : 0;
});
const MARK_REACH = 1500, MARK_HOLD = .78, MARK_GLOW = .28; // how far the light carries in the mark, how flat it stays, how warm it turns

const FORMATIONS = { blank: blank(), writing: writing(), projects: projects(), contact: contact() };
const SPIN = { blank: -.4, writing: -.34, projects: -.46, contact: -.3, card: 0 };
const PITCH_X = -.98; // how far the sheet leans back when it is not laid flat
const raw = (hex) => new Color().setHex(hex, LinearSRGBColorSpace); // shader colours stay in display space
const TINT = { blank: raw(0x8a6a4c), writing: raw(C.blue), projects: raw(C.green), contact: raw(C.orange), card: raw(C.orange) };

const FLOOR_VERTEX = `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const FLOOR_FRAGMENT = `
precision highp float;
uniform vec3 uBg, uTint, uPointer;
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
  vec3 col = uBg * (.7 + .3 * reach);
  col += uTint * (.1 * pool + .045 * spot);
  col += mix(vec3(.93, .9, .85), uTint, .45) * grid * (.008 + .085 * reach + .14 * spot);
  gl_FragColor = vec4(col, 1.);
}`;
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
      uniforms: { uBg: { value: raw(0x141311) }, uTint: { value: TINT.blank.clone() }, uPointer: { value: new Vector3() } },
    }));
    this.shadows = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: 0x0b0a09 }), N);
    this.shadows.frustumCulled = false;
    this.shadows.position.z = .04;
    this.group.add(this.floor, this.shadows, this.mesh);

    this.state = FORMATIONS.blank.map((b) => ({ ...b, h: BLOCK_H, col: new Color(b.c) }));
    this.from = this.state.map((b) => ({ ...b, col: b.col.clone() }));
    this.to = FORMATIONS.blank;
    this.formations = { ...FORMATIONS };
    this.toColors = Object.fromEntries(Object.entries(FORMATIONS).map(([k, f]) => [k, f.map((b) => new Color(b.c))]));
    this.paper = { v: 1 }; // 1 while the sheet is plain paper, the only state that carries the watermark
    this.flat = { v: 0 }; this.home = { x: 0, y: 0 }; this.cardEl = null;
    this.name = 'blank';
    this.delay = FORMATIONS.blank.map((b) => ((b.x - LEFT) / W) * .45 + ((rowY(0) - b.y) / (PITCH * ROWS)) * .55);
    this.progress = { t: 1 };
    this.pointer = { x: 0, y: 0, power: 0, tiltX: 0, tiltY: 0 };
    this.moveX = gsap.quickTo(this.pointer, 'x', { duration: .35, ease: 'power3.out' });
    this.moveY = gsap.quickTo(this.pointer, 'y', { duration: .35, ease: 'power3.out' });
    this.matrix = new Matrix4(); this.color = new Color(); this.hi = new Color(C.ink); this.warm = new Color(0xc9a27a);
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
    const scale = narrow ? Math.min((w * .84) / W, (slot.height * 1.3) / (ROWS * PITCH * .62)) : Math.min((slot.width * 1.04) / W, (h * .95) / (ROWS * PITCH * .62));
    this.group.scale.setScalar(scale);
    const cx = narrow ? w * .5 : slot.left + slot.width * .5;
    const cy = slot.top + slot.height * (narrow ? .56 : .41);
    this.home.x = cx - w / 2; this.home.y = h / 2 - cy;
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

  select(name = 'blank', duration = 1.15) {
    if (name === this.name && name !== 'card') return;
    const changed = name !== this.name;
    this.name = name;
    this.state.forEach((s, i) => { Object.assign(this.from[i], { x: s.x, y: s.y, w: s.w, h: s.h, z: s.z }); this.from[i].col.copy(s.col); });
    this.to = this.formations[name];
    gsap.killTweensOf(this.progress);
    this.progress.t = 0;
    if (this.reduced) this.progress.t = 1;
    else gsap.to(this.progress, { t: 1, duration, ease: 'none' });
    this.dirty = true;
    if (!changed) return;
    const tint = this.floor.material.uniforms.uTint.value, to = TINT[name];
    gsap.to(tint, { r: to.r, g: to.g, b: to.b, duration: this.reduced ? 0 : 1.1, ease: 'power2.out', overwrite: 'auto' });
    gsap.to(this.group.rotation, { z: SPIN[name], duration: this.reduced ? 0 : 1.3, ease: 'power3.inOut', overwrite: 'auto' });
    gsap.to(this.paper, { v: name === 'blank' ? 1 : 0, duration: this.reduced ? 0 : name === 'blank' ? 1.6 : .3, ease: 'power2.out', overwrite: 'auto' });
    gsap.to(this.flat, { v: name === 'card' ? 1 : 0, duration: this.reduced ? 0 : 1.2, ease: 'power3.inOut', overwrite: 'auto' });
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

  setReducedMotion(reduced) { this.reduced = reduced; this.dirty = true; }
  refresh() { this.dirty = true; }

  frame(delta) {
    if (!this.visible) return;
    const p = this.pointer;
    const moving = this.progress.t < 1 || p.power > .002 || gsap.isTweening(this.group.rotation) || gsap.isTweening(this.floor.material.uniforms.uTint.value) || gsap.isTweening(this.flat) || gsap.isTweening(this.paper);
    if (this.reduced && !moving && !this.dirty) return;
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
    this.floor.material.uniforms.uPointer.value.set(p.x, p.y, p.power);
    for (let i = 0; i < N; i++) {
      const a = this.from[i], b = this.to[i], s = this.state[i];
      const k = ease(Math.min(Math.max(T - this.delay[i] * spread, 0), 1));
      s.x = a.x + (b.x - a.x) * k; s.y = a.y + (b.y - a.y) * k;
      s.w = a.w + (b.w - a.w) * k; s.z = a.z + (b.z - a.z) * k;
      s.h = a.h + ((b.h ?? BLOCK_H) - a.h) * k;
      s.col.copy(a.col).lerp(colors[i], k);
      const dx = s.x - p.x, dy = s.y - p.y;
      const near = p.power * Math.exp(-(dx * dx + dy * dy) / 330);
      const wave = this.reduced ? 0 : .22 * (1 + Math.sin(this.time * .7 + s.x * .06 - s.y * .11));
      const arc = Math.sin(k * Math.PI) * 2.2;
      // In the watermark the paper is thinner: it stays down under the light and lets more of it through.
      const mark = WATERMARK[i] * this.paper.v;
      let depth = BLOCK_Z + (near * 7 * (1 - mark * MARK_HOLD) + wave) * (1 - flat * .7) + arc;
      this.color.copy(s.col).lerp(this.hi, near * .6 * (1 - mark));
      if (mark) this.color.lerp(this.warm, mark * MARK_GLOW * p.power * Math.exp(-(dx * dx + dy * dy) / MARK_REACH));
      if (i === CURSOR && !this.reduced) this.color.lerp(colors[0], (Math.sin(this.time * 3.2) > .2 ? 0 : .75) * (this.name === 'blank' ? 1 : 0));
      const visible = s.w > .06;
      if (!visible) depth = .001;
      this.matrix.makeScale(Math.max(s.w, .001), visible ? s.h : .001, depth);
      this.matrix.setPosition(s.x, s.y, s.z + depth / 2);
      this.mesh.setMatrixAt(i, this.matrix);
      this.mesh.setColorAt(i, this.color);
      // The shadow runs from the block's footprint away from the light; taller and higher blocks cast further.
      const fall = visible ? (s.z + depth) * .62 : 0, lift = visible ? s.z * .62 : 0;
      this.matrix.makeScale(visible ? s.w + fall - lift : .001, visible ? s.h + fall - lift : .001, 1);
      this.matrix.setPosition(s.x + (fall + lift) / 2, s.y - (fall + lift) / 2, 0);
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
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.observer.disconnect();
    for (const m of [this.mesh, this.shadows, this.floor]) { m.geometry.dispose(); m.material.dispose(); } this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
