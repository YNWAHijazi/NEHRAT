'use client';

import { useEffect } from 'react';

/**
 * A summary row, a blocker link or a deep link names a card by its anchor. Opening
 * the card is not enough: the card may sit inside a collapsed group, and a collapsed
 * ancestor hides the error (brief item 2). So every ancestor <details> opens too, the
 * card scrolls into view and takes focus -- from a click, from the keyboard and from
 * the address bar alike.
 */
function reveal(hash: string): void {
  if (!hash.startsWith('#req-') && hash !== '#final-review' && hash !== '#assessment') return;
  const target = document.getElementById(hash.slice(1));
  if (!target) return;
  let node: HTMLElement | null = target;
  while (node) {
    if (node instanceof HTMLDetailsElement) node.open = true;
    node = node.parentElement;
  }
  target.scrollIntoView({ block: 'start', behavior: 'smooth' });
  const focusable = target.querySelector<HTMLElement>('summary, input, textarea, select, button, a');
  (focusable ?? target).focus({ preventScroll: true });
}

export function JumpTo(): null {
  useEffect(() => {
    const onHash = () => reveal(window.location.hash);
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link) return;
      const hash = link.getAttribute('href') ?? '';
      if (!document.getElementById(hash.slice(1))) return;
      event.preventDefault();
      history.replaceState(null, '', hash);
      reveal(hash);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    document.addEventListener('click', onClick);
    return () => { window.removeEventListener('hashchange', onHash); document.removeEventListener('click', onClick); };
  }, []);
  return null;
}
