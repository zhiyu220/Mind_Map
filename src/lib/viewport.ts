// When the iPhone keyboard comes up, Safari pans the page to keep the text box in view,
// and a full-height sheet slides half off the screen (only part of the box and the sky show).
// Keep sheets to the part of the screen you can actually see: its height and where it starts.
//
// With the sheet that short, a tall text box still ran on behind the buttons at the bottom,
// and what you were typing (always the last line) was the part you couldn't see.
// So while you type in a sheet: html gets .typing (and .keyboard-up once the keyboard is measured),
// the CSS gives the box the room, and the box you're in is scrolled fully into view.

/** the visible part shrinking by more than this means a keyboard, not the toolbar hiding */
const KEYBOARD_MIN = 120;
const GAP = 10;

/** boxes you type into with the keyboard (not date or time pickers, which bring up their own wheel) */
const TYPED = ['text', 'search', 'email', 'url', 'tel', 'password', 'number'];
const isTextField = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TYPED.includes(el.type));

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
  // Writing in a sheet's text box: the CSS turns the sheet into a writing mode, where that box (.writing)
  // takes the whole strip above the keyboard and everything else steps aside (html.typing).
  // This goes by focus, not by measuring, because the iPhone doesn't always tell.
  let box: HTMLElement | null = null;
  let leaving = 0;
  const stop = () => {
    root.classList.remove('typing');
    box?.classList.remove('writing');
    box = null;
  };
  document.addEventListener('focusin', e => {
    const el = e.target as Element;
    if (!isTextField(el) || !el.closest('.sheet-body')) return;
    requestAnimationFrame(keepFieldInView);
    // again once the keyboard has finished sliding up
    setTimeout(keepFieldInView, 350);
    // one-line boxes (a PIN, a topic, a password) only need scrolling into view; the writing mode is for writing
    if (!(el instanceof HTMLTextAreaElement)) return stop();
    clearTimeout(leaving);
    if (box !== el) box?.classList.remove('writing');
    box = el;
    el.classList.add('writing');
    root.classList.add('typing');
  });
  // Leaving the box undoes the writing mode a moment later, not at once: the layout changing under a finger
  // halfway through a tap would make a tap on 下一題 or 記下來 land on nothing.
  document.addEventListener('focusout', () => {
    clearTimeout(leaving);
    leaving = window.setTimeout(() => {
      if (!(document.activeElement instanceof HTMLTextAreaElement)) stop();
    }, 250);
  });
  fit();
}

// Focus a text box as a sheet opens without Safari scrolling the page to it (the keyboard still comes up).
export const focusInPlace = (el: HTMLElement | null) => el?.focus({ preventScroll: true });
