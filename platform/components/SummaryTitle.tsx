'use client';

import { useEffect, useState } from 'react';

/**
 * The service's name in the summary at the foot of the screen, shown only once the page's own
 * title has scrolled away (owner, 10 October 2026: "why Certify an event up and down"). At the
 * top the title is on screen, so the summary does not repeat it; further down, it names the
 * service the button starts.
 */
export function SummaryTitle({ watch, children }: { watch: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const target = document.querySelector(watch);
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setShow(!entry!.isIntersecting));
    observer.observe(target);
    return () => observer.disconnect();
  }, [watch]);
  return show ? <div data-region="summary-title" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', marginBlockEnd: 8 }}>{children}</div> : null;
}
