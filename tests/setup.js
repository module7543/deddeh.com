import { vi } from 'vitest';

const listeners = new Set();
const preference = { matches: true, addEventListener: (_, callback) => listeners.add(callback) };
window.matchMedia = () => preference;
window.setTestReducedMotion = (matches) => {
  preference.matches = matches;
  listeners.forEach((callback) => callback({ matches }));
};
window.scrollTo = vi.fn();
// Exercise the real CSS fallback, rather than substituting a fake Three.js scene.
HTMLCanvasElement.prototype.getContext = () => null;
