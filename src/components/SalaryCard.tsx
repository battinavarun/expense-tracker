import { lazy, Suspense, useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { Pencil, Wifi } from 'lucide-react';
import type { MonthSummary } from '../lib/calc';
import { healthColor, healthLabel } from '../lib/colors';
import { formatINR, formatINRWhole } from '../lib/format';
import { monthLabel } from '../lib/dates';
import { AnimatedNumber } from './AnimatedNumber';
import { ErrorBoundary } from './ErrorBoundary';

// Gold coins orbiting the card — only downloaded in the 3D view.
const HeroCoins = lazy(() => import('./HeroCoins'));

interface Props {
  summary: MonthSummary;
  /** false = flat "Clean Compact View" card with no tilt and no WebGL. */
  interactive: boolean;
  /** Bumps whenever an expense is logged, so coins can fly off the card. */
  burst: number;
  onEditBudget: () => void;
}

/**
 * Dark-titanium metallic card in hardware-accelerated CSS 3D (crisp text, no GPU cost while typing),
 * wrapped in a transparent WebGL layer of gold coins that reacts to your balance.
 */
export function SalaryCard({ summary, interactive, burst, onEditBudget }: Props) {
  const reduce = useReducedMotion();
  const tilt = interactive && !reduce;
  const ref = useRef<HTMLDivElement>(null);

  const rx = useSpring(useMotionValue(0), { stiffness: 140, damping: 16, mass: 0.6 });
  const ry = useSpring(useMotionValue(0), { stiffness: 140, damping: 16, mass: 0.6 });
  const gx = useMotionValue(30);
  const gy = useMotionValue(20);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.36), rgba(255,255,255,0.07) 32%, transparent 55%)`;

  const accent = healthColor(summary.ratio);
  const status = healthLabel(summary.ratio, summary.over);
  const usedRatio = summary.available > 0 ? Math.min(1, summary.spent / summary.available) : summary.spent > 0 ? 1 : 0;

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!tilt || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * 28);
    rx.set(-(py - 0.5) * 24);
    gx.set(px * 100);
    gy.set(py * 100);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
    gx.set(30);
    gy.set(20);
  };

  return (
    <div className={`relative w-full ${interactive ? 'py-2' : ''}`}>
      {interactive && (
        <div className="pointer-events-none absolute -inset-x-3 -inset-y-9 z-30" aria-hidden>
          <ErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <HeroCoins accent={accent} ratio={summary.ratio} burst={burst} />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      <div style={{ perspective: interactive ? 1100 : undefined }} className="w-full">
        <motion.div
          ref={ref}
          onPointerMove={move}
          onPointerLeave={reset}
          onPointerCancel={reset}
          onPointerUp={(e) => e.pointerType !== 'mouse' && reset()}
          style={{
            rotateX: tilt ? rx : 0,
            rotateY: tilt ? ry : 0,
            transformStyle: 'preserve-3d',
            touchAction: 'pan-y',
          }}
          className={`relative w-full select-none ${interactive ? 'aspect-[1.72/1] min-h-[215px]' : 'min-h-[200px]'}`}
        >
          {/* slab thickness: stacked darker layers behind the face give the card a real edge when tilted */}
          {tilt &&
            [1, 2, 3, 4].map((i) => (
              <div
                key={i}
                aria-hidden
                className="absolute inset-0 rounded-[26px]"
                style={{ background: i % 2 ? '#2a2e35' : '#1a1d22', transform: `translateZ(${-i * 2.5}px)`, boxShadow: i === 4 ? '0 30px 44px -10px rgba(0,0,0,0.75)' : undefined }}
              />
            ))}

          <div
            className="absolute inset-0 rounded-[26px] p-5 sm:p-6"
            style={{
              boxShadow: `0 0 0 1.5px ${accent}, 0 0 38px ${accent}55, ${tilt ? '' : '0 24px 40px -12px rgba(0,0,0,0.7), '}inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 6px rgba(0,0,0,0.5)`,
              transition: 'box-shadow 0.6s ease',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Metal layers are clipped here; clipping the parent would flatten the 3D and kill the text parallax. */}
            <div className="titanium pointer-events-none absolute inset-0 overflow-hidden rounded-[26px]" aria-hidden>
              {tilt && <motion.div className="absolute inset-0" style={{ background: glare }} />}
              <div
                className="absolute inset-0 opacity-60"
                style={{ background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.08) 45%, transparent 55%)' }}
              />
              {!reduce && <div className="card-shine absolute inset-y-0 -left-1/3 w-1/3" />}
            </div>

            <div className="relative flex h-full flex-col justify-between" style={{ transform: tilt ? 'translateZ(28px)' : undefined }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/60">Rupee Vault · Salary</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-7 w-10 rounded-md bg-gradient-to-br from-amber-200/90 via-amber-400/70 to-amber-700/80 shadow-inner" aria-hidden>
                      <div className="m-[3px] h-[calc(100%-6px)] w-[calc(100%-6px)] rounded-[4px] border border-black/25" />
                    </div>
                    <Wifi size={16} className="rotate-90 text-white/50" aria-hidden />
                  </div>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: accent, background: `${accent}22`, boxShadow: `inset 0 0 0 1px ${accent}66, 0 0 14px ${accent}33` }}
                >
                  {status}
                </span>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                  {summary.over ? 'Over budget by' : 'Remaining balance'}
                </p>
                <p
                  className="tabular mt-1 font-mono text-[clamp(1.9rem,6.5vw,3rem)] font-bold leading-none text-white"
                  style={{ textShadow: '0 3px 0 rgba(0,0,0,0.5), 0 0 28px rgba(255,255,255,0.1)', transform: tilt ? 'translateZ(16px)' : undefined }}
                  aria-label={`Remaining balance ${formatINR(summary.remaining)}`}
                >
                  {summary.over && '−'}
                  <AnimatedNumber value={Math.abs(summary.remaining)} format={formatINRWhole} />
                </p>
              </div>

              <div>
                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-black/40 shadow-inner" aria-hidden>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
                    animate={{ width: `${usedRatio * 100}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  />
                </div>
                <div className="flex items-end justify-between gap-3 text-xs text-white/70">
                  <button
                    type="button"
                    onClick={onEditBudget}
                    className="group -ml-1.5 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-left hover:bg-white/10"
                    aria-label="Edit monthly budget"
                  >
                    <span>
                      Budget <strong className="tabular font-mono text-white">{formatINRWhole(summary.available)}</strong>
                      {(summary.carried > 0 || summary.income > 0) && (
                        <span className="text-white/50">
                          {' '}
                          (incl. {formatINRWhole(summary.carried + summary.income)} extra)
                        </span>
                      )}
                    </span>
                    <Pencil size={12} className="opacity-60 group-hover:opacity-100" />
                  </button>
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">{monthLabel(summary.month)}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
