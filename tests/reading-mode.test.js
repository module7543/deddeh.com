import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readReadingMode, applyReadingMode, initReadingMode } from '../src/reading-mode.js';

let listeners, narrow;
beforeEach(() => {
  document.documentElement.className = 'paper';
  delete document.documentElement.dataset.readingMode;
  document.documentElement.innerHTML = '<head><meta name="theme-color" content="#ece6d8"></head><body><header class="top"><a class="identity" href="/">deddeh.com</a><a class="return" href="/#writing">Writing</a></header><main><p>An unchanged article.</p></main></body>';
  document.documentElement.style.setProperty('--reading-paper', '#ece6d8');
  document.documentElement.style.setProperty('--reading-ink', '#201e1b');
  localStorage.clear();
  listeners = vi.spyOn(window, 'addEventListener');
  narrow = { matches: false, addEventListener: vi.fn() };
  vi.spyOn(window, 'matchMedia').mockReturnValue(narrow);
});
afterEach(() => {
  for (const [type, callback] of listeners.mock.calls) window.removeEventListener(type, callback);
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const button = (mode = 'ink') => document.querySelector(`[data-mode="${mode}"]`);
const compact = () => document.querySelector('.mode-switch');

describe('Writing reading preference', () => {
  it('defaults to Paper and ignores an unknown stored value', () => {
    expect(readReadingMode()).toBe('paper');
    localStorage.setItem('deddeh:reading-mode', 'automatic');
    expect(readReadingMode()).toBe('paper');
    initReadingMode();
    expect(button().getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem('deddeh:reading-mode')).toBe('automatic'); // no implicit preference write
  });
  it('restores Ink, including the browser chrome, without a transition', () => {
    localStorage.setItem('deddeh:reading-mode', 'ink');
    initReadingMode();
    expect(document.documentElement.dataset.readingMode).toBe('ink');
    expect(document.querySelector('meta[name="theme-color"]').content).toBe('#201e1b');
    expect(document.documentElement.classList.contains('is-switching-mode')).toBe(false);
  });
  it('selects each native, named option independently, including an already-active choice', () => {
    initReadingMode();
    for (const mode of ['paper', 'ink', 'ink', 'paper', 'paper']) {
      const control = button(mode);
      expect(control.tagName).toBe('BUTTON');
      expect(control.type).toBe('button');
      expect(control.textContent).toContain(mode === 'paper' ? 'Light' : 'Dark');
      control.focus();
      control.click();
      expect(control.getAttribute('aria-pressed')).toBe('true');
      expect(button(mode === 'paper' ? 'ink' : 'paper').getAttribute('aria-pressed')).toBe('false');
      expect(document.documentElement.dataset.readingMode).toBe(mode);
      expect(localStorage.getItem('deddeh:reading-mode')).toBe(mode);
      expect(document.activeElement).toBe(control);
      expect(document.querySelector('main').textContent).toBe('An unchanged article.');
    }
  });
  it('does not start or extend the fade when the active option is selected', () => {
    vi.useFakeTimers();
    initReadingMode();
    button('paper').click();
    expect(document.documentElement.classList.contains('is-switching-mode')).toBe(false);
    button('ink').click();
    vi.advanceTimersByTime(400);
    button('ink').click();
    vi.advanceTimersByTime(100);
    expect(document.documentElement.classList.contains('is-switching-mode')).toBe(false);
  });
  it('names the compact action for its destination and retains focus in both directions', () => {
    initReadingMode();
    compact().focus();
    for (const [name, mode] of [['dark', 'ink'], ['light', 'paper']]) {
      expect(compact().getAttribute('aria-label')).toBe(`Switch to ${name} reading mode`);
      expect(compact().hasAttribute('aria-pressed')).toBe(false);
      compact().click();
      expect(document.documentElement.dataset.readingMode).toBe(mode);
      expect(localStorage.getItem('deddeh:reading-mode')).toBe(mode);
      expect(document.activeElement).toBe(compact());
    }
  });
  it('moves focus to the visible equivalent on resize without changing the preference', () => {
    initReadingMode();
    const resize = narrow.addEventListener.mock.calls[0][1];
    button('ink').focus(); button('ink').click();
    narrow.matches = true; resize();
    expect(document.activeElement).toBe(compact());
    narrow.matches = false; resize();
    expect(document.activeElement).toBe(button('ink'));
    expect(localStorage.getItem('deddeh:reading-mode')).toBe('ink');
    document.querySelector('.return').focus();
    narrow.matches = true; resize();
    expect(document.activeElement).toBe(document.querySelector('.return'));
  });
  it('keeps switching and retains the current choice on pageshow when storage access throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied'); });
    initReadingMode();
    button().click();
    window.dispatchEvent(new Event('pageshow'));
    expect(button().getAttribute('aria-pressed')).toBe('true');
    button('paper').click();
    expect(document.documentElement.dataset.readingMode).toBe('paper');
  });
  it('resynchronizes a restored page and an open tab after a storage change or clear', () => {
    initReadingMode();
    localStorage.setItem('deddeh:reading-mode', 'ink');
    window.dispatchEvent(new Event('pageshow'));
    expect(button().getAttribute('aria-pressed')).toBe('true');
    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(button().getAttribute('aria-pressed')).toBe('false');
  });
  it('settles on the last choice during rapid activation', () => {
    vi.useFakeTimers();
    initReadingMode();
    button('ink').click(); button('paper').click(); button('ink').click();
    vi.advanceTimersByTime(600);
    expect(document.documentElement.dataset.readingMode).toBe('ink');
    expect(document.documentElement.classList.contains('is-switching-mode')).toBe(false);
  });
  it('does not duplicate the control and can apply a boot preference without creating UI', () => {
    applyReadingMode('ink');
    expect(button()).toBeNull();
    localStorage.setItem('deddeh:reading-mode', 'ink');
    initReadingMode(); initReadingMode();
    expect(document.querySelectorAll('.reading-mode')).toHaveLength(1);
  });
});
