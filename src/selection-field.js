import * as THREE from 'three';
import { gsap } from 'gsap';

/** The navigation's selection block, with a shallow folding edge. No idle scene. */
export class SelectionField {
  constructor(host, reducedMotion) {
    this.host = host;
    this.reducedMotion = reducedMotion;
    this.entry = null;
    this.available = false;
    this.visible = true;
    this.frame = null;
    this.caps = [];
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.setClearColor(0x000000, 0);
      this.canvas = this.renderer.domElement;
      this.canvas.className = 'selection-canvas';
      this.canvas.setAttribute('aria-hidden', 'true');
      this.host.prepend(this.canvas);
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(0, 1, 1, 0, .1, 2000);
      this.camera.position.z = 1000;
      this.group = new THREE.Group();
      this.scene.add(this.group);
      this.geometry = new THREE.PlaneGeometry(1, 1);
      this.baseMaterial = new THREE.MeshBasicMaterial({ color: '#8fafd0', side: THREE.DoubleSide });
      this.base = new THREE.Mesh(this.geometry, this.baseMaterial);
      this.group.add(this.base);
      for (let index = 0; index < 6; index++) {
        const pivot = new THREE.Group();
        const material = this.baseMaterial.clone();
        const mesh = new THREE.Mesh(this.geometry, material);
        pivot.add(mesh);
        this.group.add(pivot);
        this.caps.push({ pivot, mesh, material });
      }
      this.group.visible = false;
      this.available = true;
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(host);
      host.querySelectorAll('.entry-label').forEach((label) => this.resizeObserver.observe(label));
      this.intersectionObserver = new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        if (this.visible) this.requestRender();
      });
      this.intersectionObserver.observe(host);
      this.onVisibility = () => { if (!document.hidden) this.requestRender(); };
      document.addEventListener('visibilitychange', this.onVisibility);
      this.canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        this.available = false;
        this.host.classList.remove('graphics-ready');
        this.canvas.hidden = true;
      });
      this.canvas.addEventListener('webglcontextrestored', () => {
        this.available = true;
        this.canvas.hidden = false;
        this.select(this.entry);
        this.measure();
      });
      document.fonts?.ready.then(() => this.measure());
      this.measure();
    } catch {
      this.available = false;
      this.host.classList.remove('graphics-ready');
      this.renderer?.domElement.remove();
      this.renderer?.dispose();
    }
  }

  select(entry) {
    const changed = entry !== this.entry;
    this.entry = entry;
    if (!this.available) return;
    this.group.visible = Boolean(entry);
    if (entry) {
      this.color = new THREE.Color(getComputedStyle(entry).getPropertyValue('--accent').trim());
      this.baseMaterial.color.copy(this.color);
      this.caps.forEach(({ material }) => material.color.copy(this.color));
      this.measure();
      if (changed) this.caps.forEach(({ pivot }, index) => {
        gsap.fromTo(pivot.rotation, { y: this.reducedMotion ? 0 : -.9 }, {
          y: 0, duration: this.reducedMotion ? 0 : .58, delay: this.reducedMotion ? 0 : index * .025,
          ease: 'power3.out', overwrite: true, onUpdate: this.requestRender,
        });
      });
    }
    this.requestRender();
  }

  measure() {
    if (!this.available) return;
    const bounds = this.host.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    this.renderer.setSize(bounds.width, bounds.height, false);
    Object.assign(this.camera, { right: bounds.width, top: bounds.height });
    this.camera.updateProjectionMatrix();
    if (this.entry) {
      const label = this.entry.querySelector('.entry-label').getBoundingClientRect();
      const edgeWidth = Math.min(30, parseFloat(getComputedStyle(this.entry.querySelector('.entry-label')).paddingRight) - 4);
      const baseWidth = label.width - edgeWidth;
      this.group.position.set(label.left - bounds.left, bounds.height - (label.top - bounds.top) - label.height / 2, 0);
      this.base.position.set(baseWidth / 2, 0, 0);
      this.base.scale.set(baseWidth + .5, label.height, 1);
      this.caps.forEach(({ pivot, mesh }, index) => {
        const width = edgeWidth / this.caps.length;
        pivot.position.set(baseWidth + width * index, 0, .1);
        mesh.position.x = width / 2;
        mesh.scale.set(width + .5, label.height, 1);
      });
    }
    this.requestRender();
  }

  requestRender = () => {
    if (!this.available || !this.visible || document.hidden || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      if (!this.available) return;
      this.caps.forEach(({ pivot, material }) => {
        if (this.color) material.color.copy(this.color).multiplyScalar(.82 + .18 * Math.cos(pivot.rotation.y));
      });
      this.renderer.render(this.scene, this.camera);
      this.host.classList.add('graphics-ready');
    });
  };

  bend(position) {
    if (!this.available || this.reducedMotion || !this.entry) return;
    const angle = Math.max(0, Math.min(1, position)) * .28;
    this.caps.forEach(({ pivot }, index) => {
      gsap.to(pivot.rotation, { y: -angle * (index + 1) / this.caps.length, duration: .35, ease: 'power3.out', overwrite: true, onUpdate: this.requestRender });
    });
  }

  relax() {
    if (!this.available) return;
    this.caps.forEach(({ pivot }) => {
      gsap.to(pivot.rotation, { y: 0, duration: this.reducedMotion ? 0 : .4, overwrite: true, onUpdate: this.requestRender });
    });
  }

  setReducedMotion(value) {
    this.reducedMotion = value;
    this.caps.forEach(({ pivot }) => { gsap.killTweensOf(pivot.rotation); pivot.rotation.y = 0; });
    this.requestRender();
  }

  dispose() {
    this.available = false;
    this.host.classList.remove('graphics-ready');
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.caps.forEach(({ pivot, material }) => { gsap.killTweensOf(pivot.rotation); material.dispose(); });
    this.baseMaterial?.dispose();
    this.geometry?.dispose();
    this.renderer?.dispose();
    this.canvas?.remove();
  }
}
