import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';

const $ = (selector) => document.querySelector(selector);
const entry = (name) => $(`[data-section="${name}"]`);
const toggle = (name) => $(`#${name}-toggle`);
const panel = (name) => $(`#${name}-panel`);
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
beforeEach(async () => {
  window.setTestReducedMotion(true);
  for (const name of ['writing', 'projects', 'notes']) mouse(entry(name), 'pointerleave');
  $('.identity').click();
  $('.identity').focus();
  await Promise.resolve();
});

describe('One integrated personal index', () => {
  it('contains only the three real, currently empty sections', () => {
    expect(document.querySelectorAll('.entry-toggle')).toHaveLength(3);
    expect(document.querySelectorAll('.entry-panel:not([hidden])')).toHaveLength(0);
    expect(document.querySelectorAll('[data-design-choice], dialog, .spatial-study')).toHaveLength(0);
  });

  it.each(['writing', 'projects', 'notes'])('opens %s and toggles it closed', (name) => {
    toggle(name).click();
    expect(panel(name).hidden).toBe(false);
    expect(panel(name).textContent).toContain(`No ${name} published yet.`);
    expect(toggle(name).getAttribute('aria-expanded')).toBe('true');
    expect(location.hash).toBe(`#${name}`);
    toggle(name).click();
    expect(panel(name).hidden).toBe(true);
    expect(toggle(name).getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps just one section open when moving through the index', () => {
    toggle('writing').click();
    toggle('projects').click();
    expect(panel('writing').hidden).toBe(true);
    expect(panel('projects').hidden).toBe(false);
    expect(panel('notes').hidden).toBe(true);
  });

  it('moves focus through the index with arrows, Home, and End', () => {
    toggle('writing').focus();
    toggle('writing').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(document.activeElement).toBe(toggle('projects'));
    toggle('projects').dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(document.activeElement).toBe(toggle('notes'));
    toggle('notes').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(document.activeElement).toBe(toggle('writing'));
    toggle('writing').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(document.activeElement).toBe(toggle('notes'));
    toggle('notes').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(document.activeElement).toBe(toggle('writing'));
  });

  it('closes from Escape and restores focus to the owning section', () => {
    toggle('notes').click();
    entry('notes').querySelector('.close-section').focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel('notes').hidden).toBe(true);
    expect(document.activeElement).toBe(toggle('notes'));
    expect(location.hash).toBe('#index');
  });

  it('closes from the inline control and returns focus', () => {
    toggle('writing').click();
    entry('writing').querySelector('.close-section').click();
    expect(panel('writing').hidden).toBe(true);
    expect(document.activeElement).toBe(toggle('writing'));
  });

  it('selects one coherent highlight on hover and falls back to the open section', () => {
    toggle('writing').click();
    mouse(entry('projects'), 'pointerenter');
    expect(entry('projects').classList.contains('is-active')).toBe(true);
    expect(entry('writing').classList.contains('is-active')).toBe(false);
    mouse(entry('projects'), 'pointerleave');
    expect(entry('writing').classList.contains('is-active')).toBe(true);
    expect(document.querySelectorAll('.is-active')).toHaveLength(1);
  });

  it('restores section state when browser history changes', () => {
    history.replaceState({}, '', '#projects');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(panel('projects').hidden).toBe(false);
    expect(toggle('projects').getAttribute('aria-expanded')).toBe('true');
    history.replaceState({}, '', '#index');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(panel('projects').hidden).toBe(true);
  });

  it('handles unknown section links without inventing content', () => {
    history.replaceState({}, '', '#unpublished-article');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(document.querySelectorAll('.entry-panel:not([hidden])')).toHaveLength(0);
  });

  it('finishes panel state immediately when reduced motion is enabled', () => {
    window.setTestReducedMotion(false);
    toggle('writing').click();
    window.setTestReducedMotion(true);
    expect(panel('writing').hidden).toBe(false);
    expect(panel('writing').style.height).toBe('');
    expect(entry('writing').querySelector('.entry-word').style.opacity).toBe('1');
  });

  it('retains the functional selection when WebGL is unavailable', () => {
    toggle('projects').focus();
    expect(entry('projects').classList.contains('is-active')).toBe(true);
    expect($('.index-nav').classList.contains('graphics-ready')).toBe(false);
    toggle('projects').click();
    expect(panel('projects').hidden).toBe(false);
  });
});
