import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Html, Lightformer, OrbitControls, Sparkles } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';
import type { CategoryStat, DayPoint } from '../lib/calc';
import { CORAL } from '../lib/colors';
import { formatCompact } from '../lib/format';
import { statKey } from '../lib/keys';
import { useVisible } from '../hooks/useVisible';

export type VizMode = 'pillars' | 'ring' | 'timeline';

interface Props {
  mode: VizMode;
  stats: CategoryStat[];
  /** Month budget incl. money-in & carry — a full pillar / full ring = 100 % of this. */
  available: number;
  remaining: number;
  accent: string;
  days: DayPoint[];
  /** Even daily pace (available / days in month). */
  pace: number;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
}

const CAMERA: Record<VizMode, [number, number, number]> = {
  pillars: [0, 3.7, 9.6],
  ring: [0, 6.6, 6.8],
  timeline: [0, 3.4, 10.8],
};
const TARGET: Record<VizMode, [number, number, number]> = {
  pillars: [0, 1.4, 0],
  ring: [0, 0.2, 0],
  timeline: [0, 1.3, 0],
};

export default function Scene3D(props: Props) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const visible = useVisible(wrapRef);
  const { mode } = props;

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 1.75]}
        camera={{ position: CAMERA.pillars, fov: 36 }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: true }}
        onPointerMissed={() => {
          props.onSelect(null);
          props.onSelectDay(null);
        }}
        aria-label="Interactive 3D spending chart. Drag to rotate, click to inspect."
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 8, 5]} intensity={1.25} />
        <directionalLight position={[-6, 3, -4]} intensity={0.4} color="#8fb4ff" />

        {/* Local light-cards: glass/metal reflections without downloading an HDRI. */}
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={2.4} position={[0, 6, -4]} scale={[12, 4, 1]} />
          <Lightformer form="rect" intensity={1.6} position={[-6, 2, 3]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
          <Lightformer form="rect" intensity={1.2} position={[6, 1, 3]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
          <Lightformer form="ring" intensity={1.5} position={[0, 3, 6]} scale={4} />
        </Environment>

        <Sparkles count={38} scale={[13, 5, 9]} position={[0, 2.2, 0]} size={2.4} speed={reduce ? 0 : 0.25} opacity={0.45} color="#9fe8d0" />

        <CameraRig mode={mode} />
        <PopIn key={mode}>
          {mode === 'pillars' && <Pillars {...props} />}
          {mode === 'ring' && <Ring {...props} />}
          {mode === 'timeline' && <Timeline {...props} />}
        </PopIn>

        <ContactShadows position={[0, 0.001, 0]} opacity={0.5} scale={16} blur={2.6} far={4} resolution={256} />
        <Controls autoRotate={!reduce && props.selectedKey === null && props.selectedDay === null && mode !== 'timeline'} />
      </Canvas>
    </div>
  );
}

/** Snaps the camera to a good angle for each chart type when the mode changes. */
function CameraRig({ mode }: { mode: VizMode }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target?: THREE.Vector3; update?: () => void } | null;
  useEffect(() => {
    camera.position.set(...CAMERA[mode]);
    controls?.target?.set(...TARGET[mode]);
    controls?.update?.();
  }, [mode, camera, controls]);
  return null;
}

/** Scale-in whenever a chart mounts, so switching modes feels physical. */
function PopIn({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const ref = useRef<THREE.Group>(null);
  const s = useRef(reduce ? 1 : 0.55);
  useFrame((_, dt) => {
    s.current += (1 - s.current) * (1 - Math.pow(0.002, dt));
    ref.current?.scale.setScalar(s.current);
  });
  return <group ref={ref}>{children}</group>;
}

function Controls({ autoRotate }: { autoRotate: boolean }) {
  const ref = useRef<any>(null);
  // OrbitControls disables all touch scrolling by default. Let vertical swipes scroll the page
  // and only treat horizontal drags as "rotate", so the 3D view never traps a phone user.
  useEffect(() => {
    const dom: HTMLElement | undefined = ref.current?.domElement;
    if (dom) dom.style.touchAction = 'pan-y';
  }, []);
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      target={[0, 1.4, 0]}
      enableZoom={false}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.8}
      autoRotate={autoRotate}
      autoRotateSpeed={0.9}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}

function Floor({ radius = 7.5 }: { radius?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
      <circleGeometry args={[radius, 64]} />
      <meshStandardMaterial color="#171b21" roughness={0.9} metalness={0.1} />
    </mesh>
  );
}

/** A small DOM label that always faces the camera. */
function Tag({ position, children, strong }: { position: [number, number, number]; children: React.ReactNode; strong?: boolean }) {
  return (
    <Html position={position} center zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
      <div
        className={`whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] leading-none ${
          strong ? 'bg-black/60 font-bold text-white' : 'text-white/60'
        }`}
        style={strong ? { boxShadow: '0 0 0 1px rgba(255,255,255,0.12)' } : undefined}
      >
        {children}
      </div>
    </Html>
  );
}

/* =============================================================== PILLARS */

const H_MAX = 3.4; // world height that represents 100 % of the month's budget
const OVERFLOW_CAP = 1.18;

function Pillars({ stats, available, selectedKey, onSelect }: Props) {
  const n = stats.length;
  const spacing = n > 8 ? 1.05 : 1.35;
  const radius = n > 8 ? 0.36 : 0.46;
  const totalWidth = Math.max(1, (n - 1) * spacing + radius * 3);
  const fit = Math.min(1, 8.2 / totalWidth);

  return (
    <group scale={fit}>
      <Floor />
      {stats.map((s, i) => {
        const key = statKey(s);
        const share = available > 0 ? s.spent / available : s.spent > 0 ? 1 : 0;
        return (
          <Pillar
            key={key}
            stat={s}
            x={(i - (n - 1) / 2) * spacing}
            radius={radius}
            ratio={Math.min(share, OVERFLOW_CAP)}
            limitRatio={s.limit && available > 0 ? Math.min(s.limit / available, OVERFLOW_CAP) : null}
            selected={selectedKey === key}
            dimmed={selectedKey !== null && selectedKey !== key}
            onSelect={() => onSelect(selectedKey === key ? null : key)}
          />
        );
      })}
      {n === 0 && (
        <mesh position={[0, H_MAX / 2, 0]}>
          <cylinderGeometry args={[0.55, 0.55, H_MAX, 48]} />
          <meshPhysicalMaterial color="#ffffff" transparent opacity={0.08} roughness={0.05} clearcoat={1} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

interface PillarProps {
  stat: CategoryStat;
  x: number;
  radius: number;
  ratio: number;
  limitRatio: number | null;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
}

function Pillar({ stat, x, radius, ratio, limitRatio, selected, dimmed, onSelect }: PillarProps) {
  const reduce = useReducedMotion();
  const fillRef = useRef<THREE.Mesh>(null);
  const capRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const tagRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const height = useRef(reduce ? ratio * H_MAX : 0);
  const lift = useRef(0);
  const [hover, setHover] = useState(false);

  const color = useMemo(() => new THREE.Color(stat.color), [stat.color]);
  const over = stat.limitRatio !== null && stat.limitRatio > 1;
  const target = ratio * H_MAX;
  const minVisible = stat.spent > 0 ? 0.07 : 0;

  useEffect(() => {
    document.body.style.cursor = hover ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hover]);

  useFrame((_, dt) => {
    const k = reduce ? 1 : 1 - Math.pow(0.0008, dt); // frame-rate independent ease
    height.current += (Math.max(target, minVisible) - height.current) * k;
    const h = Math.max(height.current, 0.0001);
    if (fillRef.current) {
      fillRef.current.scale.y = h;
      fillRef.current.position.y = h / 2;
    }
    if (capRef.current) capRef.current.position.y = h + 0.005;
    if (tagRef.current) tagRef.current.position.y = h + 0.42;

    lift.current += ((selected ? 0.18 : hover ? 0.08 : 0) - lift.current) * k;
    if (groupRef.current) groupRef.current.position.y = lift.current;

    if (matRef.current) {
      const glow = selected ? 0.55 : hover ? 0.3 : 0.08;
      matRef.current.emissiveIntensity += (glow - matRef.current.emissiveIntensity) * k;
      matRef.current.opacity += ((dimmed ? 0.45 : 1) - matRef.current.opacity) * k;
    }
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[radius * 1.35, radius * 1.45, 0.06, 48]} />
        <meshStandardMaterial color="#232830" roughness={0.45} metalness={0.7} />
      </mesh>

      <group ref={groupRef}>
        <mesh ref={fillRef} scale={[1, 0.0001, 1]}>
          <cylinderGeometry args={[radius, radius, 1, 48]} />
          <meshStandardMaterial ref={matRef} color={color} emissive={color} emissiveIntensity={0.08} roughness={0.5} metalness={0.15} transparent />
        </mesh>
        <mesh ref={capRef} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[radius, 48]} />
          <meshStandardMaterial color={color} roughness={0.25} metalness={0.35} emissive={color} emissiveIntensity={0.15} />
        </mesh>

        {/* glass shell = 100 % of the month's budget */}
        <mesh position={[0, H_MAX / 2, 0]} renderOrder={2}>
          <cylinderGeometry args={[radius * 1.14, radius * 1.14, H_MAX, 48, 1, true]} />
          <meshPhysicalMaterial
            color="#ffffff"
            transparent
            opacity={dimmed ? 0.07 : 0.14}
            roughness={0.04}
            clearcoat={1}
            clearcoatRoughness={0.05}
            envMapIntensity={1.4}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {limitRatio !== null && (
          <mesh position={[0, limitRatio * H_MAX, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[radius * 1.2, 0.022, 12, 64]} />
            <meshStandardMaterial
              color={over ? CORAL : '#e8ecf1'}
              emissive={over ? CORAL : '#e8ecf1'}
              emissiveIntensity={over ? 0.9 : 0.35}
              roughness={0.3}
              metalness={0.6}
            />
          </mesh>
        )}

        <group ref={tagRef}>{stat.spent > 0 && <Tag position={[0, 0, 0]} strong>{formatCompact(stat.spent)}</Tag>}</group>
      </group>

      <Tag position={[0, -0.22, radius * 1.9]}>{stat.name.length > 11 ? `${stat.name.slice(0, 10)}…` : stat.name}</Tag>

      {/* generous invisible hit target so short pillars are easy to tap */}
      <mesh
        position={[0, H_MAX / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
      >
        <cylinderGeometry args={[radius * 1.35, radius * 1.35, H_MAX, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ================================================================== RING */

const R_OUT = 2.25;
const R_IN = 1.3;

function Ring({ stats, available, remaining, accent, selectedKey, onSelect }: Props) {
  const totalSpent = stats.reduce((s, x) => s + x.spent, 0);
  const denom = Math.max(available, totalSpent, 1);
  const GAP = 0.025;
  let cursor = Math.PI / 2; // start at 12 o'clock, sweep clockwise

  const segs: Array<{ key: string; a0: number; a1: number; color: string; stat: CategoryStat | null }> = [];
  for (const s of stats) {
    if (s.spent <= 0) continue;
    const span = (s.spent / denom) * Math.PI * 2;
    segs.push({ key: statKey(s), a0: cursor - span + GAP / 2, a1: cursor - GAP / 2, color: s.color, stat: s });
    cursor -= span;
  }
  if (remaining > 0) {
    const span = (remaining / denom) * Math.PI * 2;
    segs.push({ key: '__left__', a0: cursor - span + GAP / 2, a1: cursor - GAP / 2, color: accent, stat: null });
  }

  return (
    <group>
      <Floor radius={5.2} />
      {/* podium disc */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[R_OUT + 0.35, R_OUT + 0.45, 0.08, 96]} />
        <meshStandardMaterial color="#20252c" roughness={0.4} metalness={0.8} />
      </mesh>
      {segs.map((sg) => (
        <RingSegment
          key={sg.key}
          a0={sg.a0}
          a1={sg.a1}
          color={sg.color}
          glass={sg.stat === null}
          selected={selectedKey === sg.key}
          dimmed={selectedKey !== null && selectedKey !== sg.key}
          onClick={() => sg.stat && onSelect(selectedKey === sg.key ? null : sg.key)}
        />
      ))}
      <Html position={[0, 0.5, 0]} center zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
        <div className="text-center">
          <div className="font-mono text-lg font-bold leading-none text-white">{formatCompact(Math.abs(remaining))}</div>
          <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/55">{remaining < 0 ? 'over' : 'left'}</div>
        </div>
      </Html>
    </group>
  );
}

function RingSegment({
  a0,
  a1,
  color,
  glass,
  selected,
  dimmed,
  onClick,
}: {
  a0: number;
  a1: number;
  color: string;
  glass: boolean;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const reduce = useReducedMotion();
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const [hover, setHover] = useState(false);
  const push = useRef(0);
  const mid = (a0 + a1) / 2;

  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, R_OUT, a0, a1, false);
    shape.absarc(0, 0, R_IN, a1, a0, true);
    shape.closePath();
    const arcLen = Math.max(0.02, a1 - a0);
    return new THREE.ExtrudeGeometry(shape, {
      depth: glass ? 0.3 : 0.62,
      bevelEnabled: true,
      bevelSize: 0.03,
      bevelThickness: 0.035,
      bevelSegments: 2,
      curveSegments: Math.max(6, Math.ceil((arcLen / (Math.PI * 2)) * 110)),
    });
  }, [a0, a1, glass]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => {
    if (glass) return;
    document.body.style.cursor = hover ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hover, glass]);

  const col = useMemo(() => new THREE.Color(color), [color]);

  useFrame((_, dt) => {
    const k = reduce ? 1 : 1 - Math.pow(0.001, dt);
    push.current += ((selected ? 0.32 : hover ? 0.12 : 0) - push.current) * k;
    if (groupRef.current) {
      // shape plane (x,y) → world (x, ·, -y) after the -90° X rotation below
      groupRef.current.position.set(Math.cos(mid) * push.current, push.current * 0.5, -Math.sin(mid) * push.current);
    }
    if (matRef.current) {
      matRef.current.emissiveIntensity += ((selected ? 0.6 : hover ? 0.35 : glass ? 0.25 : 0.08) - matRef.current.emissiveIntensity) * k;
      matRef.current.opacity += ((dimmed ? 0.4 : glass ? 0.55 : 1) - matRef.current.opacity) * k;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh
        geometry={geometry}
        rotation-x={-Math.PI / 2}
        position={[0, 0.07, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
      >
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={col}
          emissiveIntensity={0.08}
          roughness={glass ? 0.12 : 0.45}
          metalness={glass ? 0.1 : 0.2}
          transparent
          opacity={glass ? 0.55 : 1}
        />
      </mesh>
    </group>
  );
}

/* =============================================================== TIMELINE */

const H_T = 3.2;
const DAY_W = 0.2;
const DAY_STEP = 0.29;

function Timeline({ days, pace, accent, selectedDay, onSelectDay }: Props) {
  const maxDay = days.reduce((m, d) => Math.max(m, d.total), 0);
  const scaleMax = Math.max(pace * 2.1, maxDay * 1.08, 1); // value that maps to H_T
  const per = (v: number) => (v / scaleMax) * H_T;
  const n = days.length;
  const width = (n - 1) * DAY_STEP;
  const fit = Math.min(1, 8.6 / (width + 1));
  const paceY = per(pace);

  return (
    <group scale={fit}>
      {/* base slab */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[width + 0.9, 0.08, 1.1]} />
        <meshStandardMaterial color="#20252c" roughness={0.4} metalness={0.8} />
      </mesh>

      {/* even-pace guide: bars poking above it spent more than an even share that day */}
      {pace > 0 && (
        <group position={[0, paceY + 0.08, 0]}>
          <mesh>
            <boxGeometry args={[width + 0.9, 0.018, 0.018]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.1} />
          </mesh>
          <mesh position={[0, -paceY / 2, -0.45]}>
            <boxGeometry args={[width + 0.9, paceY, 0.01]} />
            <meshPhysicalMaterial color="#ffffff" transparent opacity={0.05} roughness={0.05} depthWrite={false} />
          </mesh>
          <Tag position={[-(width / 2 + 0.75), 0, 0]}>{formatCompact(pace)}/day</Tag>
        </group>
      )}

      {days.map((d, i) => (
        <DayBar
          key={d.day}
          day={d}
          x={(i - (n - 1) / 2) * DAY_STEP}
          per={per}
          pace={pace}
          selected={selectedDay === d.day}
          dimmed={selectedDay !== null && selectedDay !== d.day}
          showLabel={d.day === 1 || d.day % 5 === 0 || d.day === n}
          onSelect={() => onSelectDay(selectedDay === d.day ? null : d.day)}
        />
      ))}
    </group>
  );
}

function DayBar({
  day,
  x,
  per,
  pace,
  selected,
  dimmed,
  showLabel,
  onSelect,
}: {
  day: DayPoint;
  x: number;
  per: (v: number) => number;
  pace: number;
  selected: boolean;
  dimmed: boolean;
  showLabel: boolean;
  onSelect: () => void;
}) {
  const reduce = useReducedMotion();
  const groupRef = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const lift = useRef(0);
  const total = day.total;
  const over = pace > 0 && total > pace + 0.005;
  const hitH = Math.max(per(total), 0.5);

  useEffect(() => {
    document.body.style.cursor = hover ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hover]);

  useFrame((_, dt) => {
    const k = reduce ? 1 : 1 - Math.pow(0.001, dt);
    lift.current += ((selected ? 0.22 : hover ? 0.1 : 0) - lift.current) * k;
    if (groupRef.current) groupRef.current.position.y = lift.current;
  });

  // stack category parts bottom → top
  let base = 0.08;
  const boxes = day.parts.map((p) => {
    const h = Math.max(per(p.amount), 0.02);
    const y = base + h / 2;
    base += h;
    return { ...p, h, y };
  });

  return (
    <group position={[x, 0, 0]}>
      <group ref={groupRef}>
        {total === 0 ? (
          <mesh position={[0, 0.11, 0]}>
            <boxGeometry args={[DAY_W, 0.06, DAY_W]} />
            <meshStandardMaterial
              color={day.future ? '#2a3038' : '#10b981'}
              emissive={day.future ? '#000000' : '#10b981'}
              emissiveIntensity={day.future ? 0 : 0.35}
              roughness={0.6}
              transparent
              opacity={dimmed ? 0.35 : 1}
            />
          </mesh>
        ) : (
          boxes.map((b) => (
            <GrowBox key={b.key} y={b.y} h={b.h} color={b.color} glow={over ? 0.22 : 0.06} selected={selected} dimmed={dimmed} />
          ))
        )}
        {day.isToday && (
          <mesh position={[0, 0.02, 0.0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[DAY_W * 0.9, DAY_W * 1.25, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
          </mesh>
        )}
        {over && (
          <mesh position={[0, base + 0.05, 0]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshStandardMaterial color={CORAL} emissive={CORAL} emissiveIntensity={1.2} />
          </mesh>
        )}
        {selected && total > 0 && <Tag position={[0, base + 0.4, 0]} strong>{formatCompact(total)}</Tag>}
      </group>

      {showLabel && <Tag position={[0, -0.18, 0.5]}>{day.day}</Tag>}

      <mesh
        position={[0, hitH / 2 + 0.05, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[DAY_STEP * 0.95, hitH + 0.1, 0.7]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function GrowBox({ y, h, color, glow, selected, dimmed }: { y: number; h: number; color: string; glow: number; selected: boolean; dimmed: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const reduce = useReducedMotion();
  const cur = useRef(reduce ? 1 : 0.001);
  const col = useMemo(() => new THREE.Color(color), [color]);
  useFrame((_, dt) => {
    const k = reduce ? 1 : 1 - Math.pow(0.0006, dt);
    cur.current += (1 - cur.current) * k;
    const m = ref.current;
    if (m) {
      m.scale.y = Math.max(h * cur.current, 0.0001);
      m.position.y = y - h / 2 + (h * cur.current) / 2;
    }
    if (matRef.current) {
      const g = selected ? 0.6 : glow;
      matRef.current.emissiveIntensity += (g - matRef.current.emissiveIntensity) * k;
      matRef.current.opacity += ((dimmed ? 0.35 : 1) - matRef.current.opacity) * k;
    }
  });
  return (
    <mesh ref={ref}>
      <boxGeometry args={[DAY_W, 1, DAY_W]} />
      <meshStandardMaterial ref={matRef} color={color} emissive={col} emissiveIntensity={glow} roughness={0.42} metalness={0.2} transparent />
    </mesh>
  );
}
