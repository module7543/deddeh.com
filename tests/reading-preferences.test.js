import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readReadingSize, applyReadingSize } from '../src/reading-size.js';
import { initReadingPreferences } from '../src/reading-preferences.js';

let listeners;
const root = document.documentElement;
const toggle = () => document.querySelector('.reading-toggle');
const slip = () => document.querySelector('.reading-slip');
const size = name => document.querySelector(`[data-size="${name}"]`);
beforeEach(() => {
  root.className = 'paper';
  delete root.dataset.readingMode;
  delete root.dataset.readingSize;
  document.body.innerHTML = '<header class="top"><a class="identity" href="/">deddeh.com</a><a class="return" href="/#writing">Writing</a></header><main class="prose"><p>Text with <em>emphasis</em>.</p></main>';
  localStorage.clear();
  listeners = [window, document, root].map(target => [target, vi.spyOn(target, 'addEventListener')]);
});
afterEach(() => {
  for (const [target, spy] of listeners) for (const [type, callback] of spy.mock.calls) target.removeEventListener(type, callback);
  vi.restoreAllMocks();
});

describe('The reading slip', () => {
  it('starts closed, names the current choices, and does not write preferences implicitly', () => {
    initReadingPreferences(); initReadingPreferences();
    expect(document.querySelectorAll('.reading-preferences')).toHaveLength(1);
    expect(slip().hidden).toBe(true);
    expect(toggle().getAttribute('aria-label')).toBe('Reading preferences: light, original text');
    expect(localStorage.length).toBe(0);
    toggle().click();
    expect(slip().hidden).toBe(false);
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });
  it('selects, remembers, and restores each size without changing the mode or content', () => {
    const original = document.querySelector('main').innerHTML;
    initReadingPreferences();
    document.querySelector('[data-mode="ink"]').click();
    for (const name of ['larger', 'largest', 'original', 'original']) {
      size(name).focus(); size(name).click();
      expect(root.dataset.readingSize).toBe(name);
      expect(localStorage.getItem('deddeh:reading-size')).toBe(name);
      expect(size(name).getAttribute('aria-pressed')).toBe('true');
      expect(document.activeElement).toBe(size(name));
      expect(root.dataset.readingMode).toBe('ink');
      expect(document.querySelectorAll('[data-size][aria-pressed="true"]')).toHaveLength(1);
    }
    expect(document.querySelector('main').innerHTML).toBe(original);
  });
  it('dismisses with Escape and returns focus, or lets Tab leave without a focus trap', () => {
    initReadingPreferences(); toggle().click(); size('larger').focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(slip().hidden).toBe(true);
    expect(document.activeElement).toBe(toggle());
    toggle().click(); size('largest').focus();
    document.querySelector('.return').focus();
    expect(slip().hidden).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('.return'));
  });
  it('closes on outside click without leaving focus inside a hidden slip', () => {
    initReadingPreferences(); toggle().click(); size('larger').focus();
    document.querySelector('main').click();
    expect(slip().hidden).toBe(true);
    expect(document.activeElement).toBe(toggle());
  });
  it('restores saved choices, follows another tab, and resets after storage is cleared', () => {
    localStorage.setItem('deddeh:reading-size', 'largest');
    initReadingPreferences();
    expect(size('largest').getAttribute('aria-pressed')).toBe('true');
    localStorage.setItem('deddeh:reading-size', 'larger');
    window.dispatchEvent(new StorageEvent('storage', { key: 'deddeh:reading-size' }));
    expect(size('larger').getAttribute('aria-pressed')).toBe('true');
    toggle().click(); size('larger').focus();
    window.dispatchEvent(new Event('pageshow'));
    expect(slip().hidden).toBe(true);
    expect(document.activeElement).toBe(toggle());
    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(root.dataset.readingSize).toBe('original');
  });
  it('ignores malformed saved values and bootstraps without the interactive bundle', () => {
    localStorage.setItem('deddeh:reading-size', '3.5');
    expect(readReadingSize()).toBe('original');
    applyReadingSize('largest');
    expect(root.dataset.readingSize).toBe('largest');
    expect(toggle()).toBeNull();
  });
  it('still changes size and appearance when storage is denied', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied'); });
    initReadingPreferences(); size('largest').click();
    document.querySelector('[data-mode="ink"]').click();
    window.dispatchEvent(new Event('pageshow'));
    expect(root.dataset.readingSize).toBe('largest');
    expect(root.dataset.readingMode).toBe('ink');
    expect(toggle().getAttribute('aria-label')).toBe('Reading preferences: dark, largest text');
  });
});
