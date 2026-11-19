import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';
import { useVisible } from '../hooks/useVisible';

interface Props {
  /** Health colour — tints the coins' glow. */
  accent: string;
  /** remaining / available, 0..1. More money left = more coins in orbit. */
  ratio: number;
  /** Increment to trigger a "coins fly away" burst (e.g. when an expense is logged). */
  burst: number;
}

const MAX = 34;

/**
 * A transparent WebGL layer that floats gold rupee coins around the salary card.
 * pointer-events are disabled by the parent so it never blocks tilt, taps or typing.
 */
export default function HeroCoins(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useVisible(ref);
  return (
    <div ref={ref} className="h-full w-full">
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 14], fov: 30 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        style={{ pointerEvents: 'none' }}
        aria-hidden
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 6]} intensity={1.4} />
        <Environment resolution={64} frames={1}>
          <Lightformer form="rect" intensity={3} position={[0, 5, 3]} scale={[10, 3, 1]} />
          <Lightformer form="rect" intensity={1.8} position={[-5, 0, 3]} rotation-y={Math.PI / 2} scale={[6, 4, 1]} />
          <Lightformer form="rect" intensity={1.4} position={[5, -1, 2]} rotation-y={-Math.PI / 2} scale={[6, 4, 1]} />
        </Environment>
        <Coins {...props} />
      </Canvas>
    </div>
  );
}

/** Pseudo-random but deterministic so coins don't reshuffle on re-render. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function coinGeometry() {
  // Lathe profile: raised rim + recessed face, like a real coin.
  const pts = [
    [0, 0.06],
    [0.33, 0.06],
    [0.35, 0.085],
    [0.44, 0.085],
    [0.47, 0.06],
    [0.5, 0.03],
    [0.5, -0.03],
    [0.47, -0.06],
    [0.44, -0.085],
    [0.35, -0.085],
    [0.33, -0.06],
    [0, -0.06],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 40);
}

function Coins({ accent, ratio, burst }: Props) {
  const reduce = useReducedMotion();
  const viewport = useThree((s) => s.viewport);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(coinGeometry, []);
  useEffect(() => () => geo.dispose(), [geo]);

  const seeds = useMemo(() => {
    const r = rng(7919);
    return Array.from({ length: MAX }, (_, i) => ({
      phase: (i / MAX) * Math.PI * 2 + r() * 0.35,
      speed: 0.05 + r() * 0.09,
      rad: 0.84 + r() * 0.11, // hugs the card's rim: half hidden behind it, half peeking out (and never clipped by the canvas)
      z: -1.8 + r() * 3.6,
      size: 0.5 + r() * 0.55,
      spin: 0.4 + r() * 1.1,
      bob: 0.5 + r() * 1.2,
      tilt: r() * Math.PI,
    }));
  }, []);

  const mouse = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const on = (e: PointerEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', on, { passive: true });
    return () => window.removeEventListener('pointermove', on);
  }, []);

  const energy = useRef(0);
  const lastBurst = useRef(burst);
  useEffect(() => {
    if (burst !== lastBurst.current) {
      lastBurst.current = burst;
      energy.current = 1;
    }
  }, [burst]);

  const small = typeof window !== 'undefined' && window.innerWidth < 640;
  const cap = small ? 18 : MAX;
  const target = Math.max(5, Math.round(6 + Math.min(1, Math.max(0, ratio)) * (cap - 6)));
  const vis = useRef<number[]>(new Array(MAX).fill(0));
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const accentColor = useMemo(() => new THREE.Color(accent), [accent]);

  useFrame(({ clock }, dt) => {
    const m = mesh.current;
    if (!m) return;
    const t = reduce ? 0 : clock.elapsedTime;
    energy.current = Math.max(0, energy.current - dt * 0.85);
    const e = energy.current;
    const push = e * e * 0.55; // outward fling that eases back
    const hw = viewport.width / 2;
    const hh = viewport.height / 2;

    for (let i = 0; i < MAX; i++) {
      const s = seeds[i];
      vis.current[i] += ((i < target ? 1 : 0) - vis.current[i]) * Math.min(1, dt * 4);
      const a = s.phase + t * s.speed;
      const rx = hw * s.rad * (1 + push);
      const ry = hh * s.rad * (1 + push);
      // squircle path (|cos|^0.5) so coins hug the card's rim instead of cutting across its corners
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const x = Math.sign(c) * Math.sqrt(Math.abs(c)) * rx + mouse.current.x * s.z * 0.12;
      const y = Math.sign(sn) * Math.sqrt(Math.abs(sn)) * ry * 0.98 + Math.sin(t * s.bob + s.phase) * 0.14 + mouse.current.y * s.z * 0.1;
      dummy.position.set(x, y, s.z);
      dummy.rotation.set(Math.PI / 2 + Math.sin(t * s.spin + s.tilt) * 0.9, 0, t * s.spin * 1.6 + s.tilt + e * 10);
      dummy.scale.setScalar(Math.max(0.0001, s.size * 0.62 * vis.current[i]));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    if (mat.current) mat.current.emissive.copy(accentColor).multiplyScalar(0.18 + e * 0.5);
  });

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, MAX]} frustumCulled={false}>
      <meshStandardMaterial ref={mat} color="#e8b94a" metalness={0.95} roughness={0.27} envMapIntensity={1.3} />
    </instancedMesh>
  );
}
