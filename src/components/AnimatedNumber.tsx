import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

interface Props {
  value: number;
  format: (n: number) => string;
}

/** Tweens between values so balances "roll" instead of jumping. */
export function AnimatedNumber({ value, format }: Props) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduce) {
      from.current = value;
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.55,
      ease: 'easeOut',
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
      onComplete: () => {
        from.current = value;
        setShown(value);
      },
    });
    return () => controls.stop();
  }, [value, reduce]);

  return <>{format(shown)}</>;
}
