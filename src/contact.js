// The Contact postcard: a real form whose frame, rules, stamp and postmark are the
// scene's blocks laid flat behind it. Submissions go to Formspree over AJAX.
import { initForm } from '@formspree/ajax';
import { gsap } from 'gsap';

export const FORM_ID = 'moedjgda'; // public Formspree form id; no credentials live in this repository
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COLOR = { frame: 0x4a463f, rule: 0x4a463f, line: 0x8f8879, focus: 0xdd7d45, error: 0xf08a70, stamp: 0xdd7d45, postmark: 0x4fa7a0 };
const COPY = {
  emailMissing: 'Add an email address so I can reply.',
  emailInvalid: 'That email address looks incomplete.',
  messageMissing: 'Write a message first.',
  failed: 'The message didn’t go through. Nothing you wrote is lost.',
};

export function createContact({ card, isReduced, getField, onPosted, onCloseRequest }) {
  const form = card.querySelector('form');
  const fields = { name: form.elements.name, email: form.elements.email, message: form.elements.message };
  const errors = { email: card.querySelector('#cf-email-error'), message: card.querySelector('#cf-message-error') };
  const send = card.querySelector('.send'), sendText = card.querySelector('.send-text');
  const alertText = card.querySelector('.form-error-text'), viaFormspree = card.querySelector('.via-formspree');
  const divider = card.querySelector('.card-divider'), stamp = card.querySelector('.stamp-slot');
  let open = false, busy = false, invalid = {}, reveal = null;

  // ---- blocks -------------------------------------------------------------
  function bars() {
    const R = card.getBoundingClientRect();
    if (!R.width) return null;
    const cx = R.left + R.width / 2, cy = R.top + R.height / 2, out = [];
    const row = (left, y, width, h, parts, c, z = 0) => {
      const gap = 3, total = parts.reduce((a, b) => a + b, 0);
      let x = left;
      for (const part of parts) {
        const w = (width - gap * (parts.length - 1)) * (part / total);
        out.push({ x: x + w / 2 - cx, y: y - cy, w, h, c, z });
        x += w + gap;
      }
    };
    const even = (n) => Array(n).fill(1);
    row(R.left, R.top + 3, R.width, 6, even(10), COLOR.frame);
    row(R.left, R.bottom - 3, R.width, 6, even(10), COLOR.frame);
    const d = divider.getBoundingClientRect();
    if (d.height > 20) for (let i = 0; i < 12; i++) row(d.left + d.width / 2 - 3.5, d.top + (d.height * (i + .5)) / 12, 7, 7, [1], COLOR.rule);
    const active = document.activeElement;
    const tone = (key, rest) => (invalid[key] ? COLOR.error : !busy && active === fields[key] ? COLOR.focus : rest);
    for (const key of ['name', 'email']) {
      const r = fields[key].getBoundingClientRect();
      row(r.left, r.bottom - 2, r.width, 4, [5, 3, 2], tone(key, COLOR.line));
    }
    const m = fields.message.getBoundingClientRect(), style = getComputedStyle(fields.message);
    const lh = parseFloat(style.lineHeight) || 32, pad = parseFloat(style.paddingTop) || 0;
    const lines = Math.max(1, Math.round((m.height - pad) / lh));
    const cuts = [[5, 3, 2], [3, 4, 3], [4, 2, 4], [2, 5, 3]];
    for (let i = 0; i < lines; i++) row(m.left, m.top + pad + (i + 1) * lh - 2, m.width, 3, cuts[i % 4], i === 0 ? tone('message', COLOR.rule) : COLOR.rule);
    const s = stamp.getBoundingClientRect();
    row(s.left, s.top + s.height * .25, s.width, s.height / 2 - 2, [1], COLOR.stamp, 1.2);
    row(s.left, s.top + s.height * .75, s.width, s.height / 2 - 2, [1], COLOR.stamp, 1.2);
    [[-34, .3], [-26, .5], [-34, .7]].forEach(([dx, t]) => row(s.left + dx, s.top + s.height * t, 46, 5, [1], COLOR.postmark, 2.2));
    const focused = !busy && Object.values(fields).find((el) => el === active);
    let cursor = null;
    if (focused) {
      const r = focused.getBoundingClientRect();
      const y = focused === fields.message ? r.top + pad + lh / 2 : r.top + r.height / 2;
      cursor = { x: r.left - 11 - cx, y: y - cy, w: 6, h: 20, c: COLOR.focus, z: 1.5 };
    }
    return { list: out, cursor };
  }
  function draw(duration) {
    if (!open) return;
    const b = bars();
    if (b) getField()?.card(card, b.list, b.cursor, duration);
  }

  // ---- validation and state ------------------------------------------------
  function setError(key, text) {
    invalid[key] = Boolean(text);
    errors[key].textContent = text || '';
    errors[key].hidden = !text;
    if (text) fields[key].setAttribute('aria-invalid', 'true'); else fields[key].removeAttribute('aria-invalid');
  }
  function validate() {
    const email = fields.email.value.trim();
    setError('email', !email ? COPY.emailMissing : EMAIL.test(email) ? '' : COPY.emailInvalid);
    setError('message', fields.message.value.trim() ? '' : COPY.messageMissing);
    return invalid.email ? fields.email : invalid.message ? fields.message : null;
  }
  function setAlert(text) {
    alertText.textContent = text || '';
    viaFormspree.hidden = !text;
    sendText.textContent = busy ? 'Sending' : text ? 'Try again' : 'Send';
  }
  function setBusy(next) {
    busy = next;
    form.setAttribute('aria-busy', String(busy));
    send.setAttribute('aria-disabled', String(busy));
    send.classList.toggle('is-busy', busy);
    for (const el of Object.values(fields)) el.readOnly = busy;
    sendText.textContent = busy ? 'Sending' : alertText.textContent ? 'Try again' : 'Send';
    draw(.4);
  }

  // Runs before Formspree's own submit handler: stop duplicates and invalid sends there.
  form.addEventListener('submit', (event) => {
    if (busy) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    setAlert('');
    const first = validate();
    draw(.4);
    if (!first) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    first.focus();
  });
  initForm({
    formElement: form,
    formId: FORM_ID,
    useDefaultStyles: false,
    disable: () => setBusy(true),
    enable: () => setBusy(false),
    renderFieldErrors: () => {}, renderSuccess: () => {}, renderFormError: () => {},
    onSuccess: () => { form.reset(); invalid = {}; setAlert(''); onPosted(); },
    onError: (context, error) => {
      // Formspree's field errors come back by field name; anything else (including a network failure) is form-level.
      const byField = Object.fromEntries(error.getAllFieldErrors());
      for (const key of ['email', 'message']) if (byField[key]) setError(key, byField[key][0].message || COPY.emailInvalid);
      const first = invalid.email ? fields.email : invalid.message ? fields.message : null;
      if (first) first.focus(); else setAlert(COPY.failed);
    },
    onFailure: () => setAlert(COPY.failed),
  });
  // The same message through Formspree's own page, in a new tab, for when the in-page send is refused.
  viaFormspree.addEventListener('click', () => { form.target = '_blank'; form.submit(); form.removeAttribute('target'); });

  for (const key of ['email', 'message']) fields[key].addEventListener('input', () => { if (invalid[key]) { setError(key, ''); draw(.4); } });
  form.addEventListener('focusin', () => draw(.4));
  form.addEventListener('focusout', () => queueMicrotask(() => draw(.4)));
  card.querySelector('.card-close').addEventListener('click', () => onCloseRequest());
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => draw(.3)).observe(card);
  window.addEventListener('scroll', () => getField()?.refresh(), { passive: true });

  return {
    get isOpen() { return open; },
    draw,
    open({ keyboard = false, focus = true } = {}) {
      if (open) return;
      open = true;
      reveal?.kill();
      card.hidden = false;
      draw();
      const parts = card.querySelectorAll('.card-head > *, .field, .card-foot > *');
      if (isReduced()) gsap.set([card, ...parts], { clearProps: 'opacity,transform' });
      else reveal = gsap.timeline()
        .fromTo(card, { opacity: 0 }, { opacity: 1, duration: .3, ease: 'power1.out' }, .25)
        .fromTo(parts, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .55, stagger: .05, ease: 'power3.out', clearProps: 'transform' }, .35);
      // A keyboard user lands in the first field; a pointer or touch user on the card, so no on-screen keyboard jumps up.
      if (focus) (keyboard ? fields.name : card.querySelector('.card-title')).focus({ preventScroll: !keyboard });
    },
    close() {
      if (!open) return;
      open = false;
      reveal?.kill();
      const hide = () => { if (!open) card.hidden = true; };
      if (isReduced()) hide(); else reveal = gsap.timeline().to(card, { opacity: 0, duration: .2, ease: 'power1.in', onComplete: hide });
    },
  };
}
