// The proof: before an essay opens, its page is laid out out of sight at the size of this window,
// and the position of every word on its first screen is read from it. The blocks are then set
// exactly there, so that when the page arrives its words stand where the blocks stood.
const MAX = 140; // one block a bar; the sheet has 140 and a cursor
const PAPER = [236, 230, 216], BLUE = [111, 159, 224];
const rgb = (text) => (text.match(/[\d.]+/g) ?? [0, 0, 0]).slice(0, 3).map(Number);
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hex = (c) => (c[0] << 16) | (c[1] << 8) | c[2];
const clear = (text) => !text || text === 'transparent' || /,\s*0\)$/.test(text);

export function createProof({ isReduced, hasField }) {
  let frame = null, href = null;

  // Laying the page out ahead of time also means it is already cached when it is opened.
  function prepare(link) {
    if (!link || isReduced() || !hasField() || link.href === href) return;
    href = link.href;
    if (!frame) {
      frame = document.createElement('iframe');
      frame.className = 'proof-frame';
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.inert = true;
      document.body.append(frame);
    }
    frame.src = href;
  }

  // Returns the bars for the sheet (from the window's centre) and for the page (from its corner), or null if the page is not ready.
  function measure(link) {
    try {
      const doc = frame?.contentDocument, main = doc?.querySelector('main');
      if (!main || link.href !== href || doc.readyState !== 'complete' || (doc.fonts && doc.fonts.status !== 'loaded')) return null;
      const view = doc.defaultView, height = view.innerHeight, words = [];
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ALL);
      const range = doc.createRange();
      let below = 0;
      for (let node = walker.nextNode(); node && below < 40; node = walker.nextNode()) {
        if (node.nodeType === 1) { // a plain bar: the slug's mark, the rule above the title
          if (!node.hasAttribute('data-bar')) continue;
          const r = node.getBoundingClientRect();
          if (r.width && r.top < height) words.push({ l: r.left, t: r.top, w: r.width, h: r.height, c: rgb(view.getComputedStyle(node).backgroundColor), big: true });
          continue;
        }
        if (node.nodeType !== 3 || !node.parentElement.closest('main')) continue;
        const style = view.getComputedStyle(node.parentElement), size = parseFloat(style.fontSize);
        if (style.visibility === 'hidden') continue;
        const mark = node.parentElement.closest('mark'), linked = node.parentElement.closest('.prose a');
        const tall = style.textTransform === 'uppercase' ? .7 : .46, big = size >= 40;
        const ink = mark && !clear(view.getComputedStyle(mark).backgroundColor) ? rgb(view.getComputedStyle(mark).backgroundColor) : linked ? BLUE : mix(rgb(style.color), PAPER, big ? 0 : .5);
        for (const match of node.data.matchAll(/\S+/g)) {
          range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
          const r = range.getClientRects()[0];
          if (!r || r.width < 1) continue;
          if (r.top > height) { below++; continue; }
          const h = mark ? mark.getBoundingClientRect().height : size * tall;
          const box = mark ? mark.getBoundingClientRect() : r;
          words.push({ l: box.left, t: r.top + r.height / 2 - h / 2, w: box.width, h, c: ink, big, line: Math.round(r.top), block: node.parentElement });
        }
      }
      if (!words.length) return null;
      // More words than blocks: join neighbours on a line of running text until they fit.
      let bars = words;
      for (let pass = 0; pass < 5 && bars.length > MAX; pass++) {
        const next = [];
        for (let i = 0; i < bars.length; i++) {
          const a = bars[i], b = bars[i + 1];
          if (b && !a.big && !b.big && a.line === b.line && a.block === b.block && b.l > a.l) { next.push({ ...a, w: b.l + b.w - a.l }); i++; } else next.push(a);
        }
        bars = next;
      }
      bars = bars.slice(0, MAX);
      const box = frame.getBoundingClientRect(), cx = box.width / 2, cy = box.height / 2;
      return {
        field: bars.map((b) => ({ x: b.l + b.w / 2 - cx, y: b.t + b.h / 2 - cy, w: b.w, h: b.h, c: hex(b.c), z: 0 })),
        page: bars.map((b) => [Math.round(b.l * 10) / 10, Math.round(b.t * 10) / 10, Math.round(b.w * 10) / 10, Math.round(b.h * 10) / 10, hex(b.c)]),
      };
    } catch { return null; }
  }

  return { prepare, measure, get frame() { return frame; } };
}
