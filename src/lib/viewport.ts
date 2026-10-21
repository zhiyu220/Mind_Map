// When the iPhone keyboard comes up, Safari pans the page to keep the text box in view,
// and a full-height sheet slides half off the screen (only part of the box and the sky show).
// Keep sheets to the part of the screen you can actually see: its height and where it starts.

export function fitSheetsToKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  const fit = () => {
    root.style.setProperty('--seen-h', `${vv.height}px`);
    root.style.setProperty('--seen-top', `${vv.offsetTop}px`);
  };
  vv.addEventListener('resize', fit);
  vv.addEventListener('scroll', fit);
  fit();
}

// Focus a text box as a sheet opens without Safari scrolling the page to it (the keyboard still comes up).
export const focusInPlace = (el: HTMLElement | null) => el?.focus({ preventScroll: true });
