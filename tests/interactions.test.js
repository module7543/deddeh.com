import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';

const $ = (selector) => document.querySelector(selector);
const item = (name) => $(`.toc-item[data-section="${name}"]`);
function mouse(element, type) {
  const event = new Event(type);
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  element.dispatchEvent(event);
}

beforeAll(async () => {
  document.documentElement.innerHTML = readFileSync('index.html', 'utf8').replace(/<!doctype html>/i, '');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await import('../src/main.js');
});
afterAll(() => vi.restoreAllMocks());
beforeEach(() => {
  for (const name of ['writing', 'projects', 'contact']) mouse(item(name), 'pointerleave');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  document.activeElement?.blur();
});

describe('The index, its statement and the figure caption', () => {
  it('starts idle with Writing, Projects and Contact and no invented content', () => {
    expect([...document.querySelectorAll('.toc-item')].map((el) => el.dataset.section)).toEqual(['writing', 'projects', 'contact']);
    expect($('.statement').textContent).toContain('A personal site');
    expect($('.figure-no').textContent).toBe('Fig. 0');
    expect(document.querySelectorAll('article, time, form, input, a[href^="mailto:"]')).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/unwritten|nothing published/i);
  });

  it.each([['writing', 'Fig. 1', 'Essays'], ['projects', 'Fig. 2', 'Software'], ['contact', 'Fig. 3', 'correspondence']])('previews %s on hover and returns to idle', (name, figure, words) => {
    mouse(item(name), 'pointerenter');
    expect(item(name).classList.contains('is-active')).toBe(true);
    expect($('.statement').textContent).toContain(words);
    expect($('.figure-no').textContent).toBe(figure);
    expect($(`[data-mark="${name}"]`).classList.contains('is-on')).toBe(true);
    mouse(item(name), 'pointerleave');
    expect($('.figure-no').textContent).toBe('Fig. 0');
    expect(document.querySelectorAll('.marks .is-on')).toHaveLength(0);
  });

  it('pins one section at a time, records it in the URL, and Escape clears it', () => {
    item('writing').click();
    expect(item('writing').getAttribute('aria-pressed')).toBe('true');
    expect(location.hash).toBe('#writing');
    item('contact').click();
    expect(item('writing').getAttribute('aria-pressed')).toBe('false');
    expect(item('contact').getAttribute('aria-pressed')).toBe('true');
    expect($('.figure-no').textContent).toBe('Fig. 3');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(item('contact').getAttribute('aria-pressed')).toBe('false');
    expect(location.hash).toBe('');
    expect($('.figure-no').textContent).toBe('Fig. 0');
  });

  it('toggles a pinned section off when chosen again', () => {
    item('projects').click();
    item('projects').click();
    expect(item('projects').getAttribute('aria-pressed')).toBe('false');
  });

  it('lets keyboard activation outrank a resting mouse hover', () => {
    mouse(item('projects'), 'pointerenter');
    item('contact').click(); // detail 0, as a keyboard activation
    expect($('.figure-no').textContent).toBe('Fig. 3');
  });

  it('moves between sections with the arrow keys', () => {
    item('writing').focus();
    item('writing').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(item('projects'));
    item('projects').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(item('contact'));
  });

  it('keeps the page usable when WebGL is unavailable', async () => {
    await vi.waitFor(() => expect($('.stage').classList.contains('is-fallback')).toBe(true));
  });
});
