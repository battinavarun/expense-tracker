import { useEffect, useState, type RefObject } from 'react';

/** True while the element is on screen. Used to pause WebGL when scrolled away (saves battery). */
export function useVisible(ref: RefObject<Element>, threshold = 0.05): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return visible;
}
