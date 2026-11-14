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
  for (const name of ['writing', 'projects', 'notes']) mouse(item(name), 'pointerleave');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  document.activeElement?.blur();
});

describe('The index and its readout', () => {
  it('starts idle with three sections and no invented content', () => {
    expect(document.querySelectorAll('.toc-item')).toHaveLength(3);
    expect($('.readout-text').textContent).toBe('Unwritten');
    expect($('.detail').textContent).toContain('choose a section');
    expect(document.querySelectorAll('article, time')).toHaveLength(0);
  });

  it.each(['writing', 'projects', 'notes'])('previews %s on hover and returns to idle', (name) => {
    mouse(item(name), 'pointerenter');
    expect(item(name).classList.contains('is-active')).toBe(true);
    expect($('.readout-text').textContent.toLowerCase()).toBe(name);
    expect($('.detail').textContent).toContain('Nothing published yet.');
    mouse(item(name), 'pointerleave');
    expect($('.readout-text').textContent).toBe('Unwritten');
  });

  it('pins one section at a time, records it in the URL, and Escape clears it', () => {
    item('writing').click();
    expect(item('writing').getAttribute('aria-pressed')).toBe('true');
    expect(location.hash).toBe('#writing');
    item('notes').click();
    expect(item('writing').getAttribute('aria-pressed')).toBe('false');
    expect(item('notes').getAttribute('aria-pressed')).toBe('true');
    expect($('.readout-text').textContent).toBe('Notes');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(item('notes').getAttribute('aria-pressed')).toBe('false');
    expect(location.hash).toBe('');
    expect($('.readout-text').textContent).toBe('Unwritten');
  });

  it('toggles a pinned section off when chosen again', () => {
    item('projects').click();
    item('projects').click();
    expect(item('projects').getAttribute('aria-pressed')).toBe('false');
  });

  it('moves between sections with the arrow keys and previews the focused one', () => {
    item('writing').focus();
    item('writing').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(item('projects'));
    item('projects').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(item('notes'));
  });

  it('keeps the page usable when WebGL is unavailable', async () => {
    await vi.waitFor(() => expect($('.stage').classList.contains('is-fallback')).toBe(true));
  });
});
