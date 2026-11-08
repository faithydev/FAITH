'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Quality } from './capability';
import { buildShapes } from './particle-shapes';

const COUNT: Record<Quality, number> = { high: 7200, medium: 4600, low: 2600 };
const DPR: Record<Quality, number> = { high: 1.75, medium: 1.4, low: 1 };

const VERT = `
attribute vec3 aColor;
attribute float aRand;
uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vFade;
void main() {
  vec3 p = position;
  // Every point breathes a little on its own, so a still shape still feels alive.
  p += 0.022 * vec3(sin(uTime * 0.9 + aRand * 40.0), cos(uTime * 0.7 + aRand * 31.0), sin(uTime * 0.8 + aRand * 17.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.55 + aRand * 0.9) * uPixelRatio * (8.0 / -mv.z);
  vColor = aColor;
  vFade = smoothstep(15.0, 5.0, -mv.z);
}`;

const FRAG = `
varying vec3 vColor;
varying float vFade;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(vColor * a * vFade, a * vFade);
}`;

const WHITE = [0.86, 0.92, 0.89];
const NEON = [0.0, 1.0, 0.4];
const DIM = [0.1, 0.22, 0.15];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function Particles({ keys, quality, progress }: { keys: string[]; quality: Quality; progress: React.RefObject<number> }) {
  const n = COUNT[quality];
  const shapes = useMemo(() => buildShapes(keys, n), [keys, n]);
  const { gl } = useThree();
  const group = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const state = useRef({ shown: -1, smooth: 0 });

  const { geometry, colors, rand, dirs, material } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const position = new Float32Array(shapes[0]!.pos);
    const colors = new Float32Array(n * 3);
    const rand = new Float32Array(n);
    const dirs = new Float32Array(n * 3);
    let seed = 7;
    const r = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    for (let i = 0; i < n; i++) {
      rand[i] = r();
      const u = r() * 2 - 1;
      const t = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      dirs[i * 3] = s * Math.cos(t);
      dirs[i * 3 + 1] = u;
      dirs[i * 3 + 2] = s * Math.sin(t);
    }
    g.setAttribute('position', new THREE.BufferAttribute(position, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uTime: { value: 0 }, uSize: { value: quality === 'low' ? 5.5 : 4.4 }, uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, DPR[quality]) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, colors, rand, dirs, material };
  }, [shapes, n, quality]);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const b = gl.domElement.getBoundingClientRect();
      pointer.current.x = ((e.clientX - b.left) / b.width - 0.5) * 2;
      pointer.current.y = ((e.clientY - b.top) / b.height - 0.5) * 2;
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [gl]);

  const colorOf = (flag: number) => (flag === 1 ? NEON : flag === 2 ? DIM : WHITE);

  useFrame((frame, dt) => {
    material.uniforms.uTime!.value = frame.clock.elapsedTime;
    const delta = Math.min(dt, 0.05);
    const st = state.current;
    // The scroll position is eased, so a flick of the wheel becomes a smooth morph.
    st.smooth = THREE.MathUtils.damp(st.smooth, progress.current ?? 0, 3.2, delta);
    const g = group.current;
    if (g) {
      const time = frame.clock.elapsedTime;
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, Math.sin(time * 0.22) * 0.38 + pointer.current.x * 0.35, 2.4, delta);
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, Math.sin(time * 0.17) * 0.08 + pointer.current.y * 0.2, 2.4, delta);
    }
    if (Math.abs(st.smooth - st.shown) < 0.0005) return;
    st.shown = st.smooth;

    const last = shapes.length - 1;
    const i0 = Math.min(Math.floor(st.smooth), last);
    const i1 = Math.min(i0 + 1, last);
    // Each shape holds for the middle of its scroll range, then gives way to the next.
    const f = smooth(0.2, 0.8, st.smooth - i0);
    const a = shapes[i0]!;
    const b = shapes[i1]!;
    const pos = geometry.attributes.position!.array as Float32Array;
    for (let i = 0; i < n; i++) {
      // Points leave at slightly different moments, which reads as a swarm, not a slide.
      let t = (f - rand[i]! * 0.35) / 0.65;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const e = t * t * (3 - 2 * t);
      const lift = Math.sin(Math.PI * e) * (0.6 + rand[i]! * 0.9);
      for (let k = 0; k < 3; k++) {
        const j = i * 3 + k;
        pos[j] = a.pos[j]! + (b.pos[j]! - a.pos[j]!) * e + dirs[j]! * lift;
      }
      const ca = colorOf(a.accent[i]!);
      const cb = colorOf(b.accent[i]!);
      for (let k = 0; k < 3; k++) colors[i * 3 + k] = ca[k]! + (cb[k]! - ca[k]!) * e;
    }
    geometry.attributes.position!.needsUpdate = true;
    geometry.attributes.aColor!.needsUpdate = true;
  });

  return (
    <group ref={group}>
      <points geometry={geometry} material={material} />
    </group>
  );
}

export default function EcosystemStoryScene({ keys, quality, active, progress }: { keys: string[]; quality: Quality; active: boolean; progress: React.RefObject<number> }) {
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, DPR[quality]]}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 7.2], fov: 45 }}
      aria-hidden
    >
      <Particles keys={keys} quality={quality} progress={progress} />
    </Canvas>
  );
}
