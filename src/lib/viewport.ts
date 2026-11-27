// When the iPhone keyboard comes up, Safari pans the page to keep the text box in view,
// and a full-height sheet slides half off the screen (only part of the box and the sky show).
// Keep sheets to the part of the screen you can actually see: its height and where it starts.
//
// With the sheet that short, a tall text box still ran on behind the buttons at the bottom,
// and what you were typing (always the last line) was the part you couldn't see.
// So while the keyboard is up: html gets .keyboard-up (the CSS gives the box less height
// and the sheet less padding), and the box you're in is scrolled fully into view.

/** the visible part shrinking by more than this means a keyboard, not the toolbar hiding */
const KEYBOARD_MIN = 120;
const GAP = 10;

const isTextField = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'].includes(el.type));

/** Scroll the sheet so the whole text box you're typing in sits between the top bar and the buttons. */
export function keepFieldInView() {
  const el = document.activeElement;
  if (!isTextField(el)) return;
  const body = el.closest<HTMLElement>('.sheet-body');
  if (!body) return;
  const b = body.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (r.bottom > b.bottom - GAP) body.scrollTop += Math.min(r.bottom - (b.bottom - GAP), r.top - (b.top + GAP));
  else if (r.top < b.top + GAP) body.scrollTop -= b.top + GAP - r.top;
}

export function fitSheetsToKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  const fit = () => {
    root.style.setProperty('--seen-h', `${vv.height}px`);
    root.style.setProperty('--seen-top', `${vv.offsetTop}px`);
    const up = window.innerHeight - vv.height > KEYBOARD_MIN;
    root.classList.toggle('keyboard-up', up);
    if (up) keepFieldInView();
  };
  vv.addEventListener('resize', fit);
  vv.addEventListener('scroll', fit);
  // the keyboard may already be up (moving from one box to the next): the resize won't come
  document.addEventListener('focusin', () => requestAnimationFrame(keepFieldInView));
  fit();
}

// Focus a text box as a sheet opens without Safari scrolling the page to it (the keyboard still comes up).
export const focusInPlace = (el: HTMLElement | null) => el?.focus({ preventScroll: true });
