// Self-contained: Vite also inlines these functions before the first article paint.
export function readReadingSize(fallback = 'original') {
  try {
    const size = localStorage.getItem('deddeh:reading-size');
    return ['larger', 'largest'].includes(size) ? size : 'original';
  } catch { return fallback; }
}

export function applyReadingSize(size) {
  document.documentElement.dataset.readingSize = size;
}

// Remember the first visible word, not a percentage of a changing document height.
// A Range survives reflow and includes inline emphasis and links without editing them.
export function readingAnchor() {
  if (!window.scrollY) return null;
  const edge = (document.querySelector('.top')?.getBoundingClientRect().bottom || 0) + 24;
  const blocks = document.querySelectorAll('.prose > p, .noted > p, .prose h2, .pull p, .note');
  for (const block of blocks) {
    const box = block.getBoundingClientRect();
    if (box.bottom <= edge || box.top >= innerHeight) continue;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const word of node.data.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, word.index);
        range.setEnd(node, word.index + word[0].length);
        const rect = range.getBoundingClientRect();
        if (rect.top >= edge && rect.top < innerHeight) return { range, top: rect.top };
      }
    }
  }
  return null;
}

export function resizeReading(size) {
  if (size === document.documentElement.dataset.readingSize) return;
  const anchor = readingAnchor();
  applyReadingSize(size);
  if (anchor) window.scrollBy({ top: anchor.range.getBoundingClientRect().top - anchor.top, behavior: 'instant' });
}
