'use client';

import { palette } from '@faith/design-tokens';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Quality } from './capability';

const TILE = new THREE.Color(palette.neon[500]);
const PAPER = new THREE.Color('#FFFFFF');
const GRAPHITE = new THREE.Color(palette.neon[300]);

const CONFIG = {
  high: { nodes: 150, dust: 900, pulses: 26, dpr: 1.75, segments: 2 },
  medium: { nodes: 96, dust: 420, pulses: 16, dpr: 1.4, segments: 1 },
  low: { nodes: 54, dust: 160, pulses: 8, dpr: 1, segments: 1 },
} as const;

/** A seeded generator, so the network has the same shape on every visit. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

type Graph = { positions: THREE.Vector3[]; edges: [number, number][]; sizes: number[] };

/**
 * Nodes on a loose shell that thickens toward an ascending ridge, a quiet reference to the
 * rising bars of the mark. Each node links to its nearest neighbours, which reads as a
 * network of people and businesses without showing any literal object.
 */
function buildGraph(count: number): Graph {
  const rand = rng(20261107);
  const positions: THREE.Vector3[] = [];
  const sizes: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const theta = t * Math.PI * 2 * 7.3 + rand() * 0.6;
    const y = (t - 0.5) * 5.2 + (rand() - 0.5) * 0.7;
    const radius = 2.1 + Math.sin(t * Math.PI) * 1.2 + (rand() - 0.5) * 0.9;
    positions.push(new THREE.Vector3(Math.cos(theta) * radius, y * 0.72, Math.sin(theta) * radius));
    sizes.push(0.012 + rand() ** 4 * 0.05);
  }
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  positions.forEach((p, i) => {
    const nearest = positions
      .map((q, j) => ({ j, d: p.distanceToSquared(q) }))
      .filter((n) => n.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    for (const { j, d } of nearest) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (d < 2.4 && !seen.has(key)) {
        seen.add(key);
        edges.push([i, j]);
      }
    }
  });
  return { positions, edges, sizes };
}

function Nodes({ graph, segments }: { graph: Graph; segments: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    graph.positions.forEach((p, i) => {
      const s = graph.sizes[i]!;
      m.makeScale(s, s, s).setPosition(p);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.copy(s > 0.042 ? TILE : PAPER));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [graph]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, graph.positions.length]}>
      <icosahedronGeometry args={[1, segments]} />
      <meshStandardMaterial roughness={0.28} metalness={0.55} toneMapped={false} />
    </instancedMesh>
  );
}

function Edges({ graph }: { graph: Graph }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(graph.edges.length * 6);
    graph.edges.forEach(([a, b], i) => {
      graph.positions[a]!.toArray(arr, i * 6);
      graph.positions[b]!.toArray(arr, i * 6 + 3);
    });
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, [graph]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={GRAPHITE} transparent opacity={0.12} />
    </lineSegments>
  );
}

/** Light travelling along edges: value moving between people. */
function Pulses({ graph, count }: { graph: Graph; count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const state = useMemo(() => {
    const rand = rng(7);
    return Array.from({ length: count }, () => ({
      edge: Math.floor(rand() * graph.edges.length), t: rand(), speed: 0.12 + rand() * 0.3,
    }));
  }, [count, graph]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh || graph.edges.length === 0) return;
    state.forEach((p, i) => {
      p.t += dt * p.speed;
      if (p.t >= 1) {
        p.t = 0;
        p.edge = (p.edge * 31 + i + 7) % graph.edges.length;
      }
      const [a, b] = graph.edges[p.edge]!;
      v.lerpVectors(graph.positions[a]!, graph.positions[b]!, p.t);
      const s = 0.022 * Math.sin(p.t * Math.PI);
      m.makeScale(s, s, s).setPosition(v);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={TILE} toneMapped={false} />
    </instancedMesh>
  );
}

function Dust({ count }: { count: number }) {
  const geometry = useMemo(() => {
    const rand = rng(99);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      arr[i] = (rand() - 0.5) * 16;
      arr[i + 1] = (rand() - 0.5) * 10;
      arr[i + 2] = (rand() - 0.5) * 12 - 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <points geometry={geometry}>
      <pointsMaterial color={PAPER} size={0.012} sizeAttenuation transparent opacity={0.42} depthWrite={false} />
    </points>
  );
}

function Rig({ graph, quality, scrollProgress, shift }: { graph: Graph; quality: Quality; scrollProgress: React.RefObject<number>; shift: number }) {
  const group = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const { camera, size } = useThree();

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const scroll = scrollProgress.current ?? 0;
    const delta = Math.min(dt, 0.05);
    g.rotation.y += delta * 0.055;
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, pointer.current.y * 0.14 + scroll * 0.5, 2.2, delta);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, -pointer.current.x * 0.06, 2.2, delta);
    const wide = size.width >= 900;
    g.position.x = THREE.MathUtils.damp(g.position.x, (wide ? shift : 0) + pointer.current.x * 0.16, 2.2, delta);
    g.position.y = THREE.MathUtils.damp(g.position.y, wide ? 0 : 1.1, 2.2, delta);
    const scale = (wide ? 1 : 0.72) * (1 + scroll * 0.34);
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, scale, 3, delta));
    camera.position.z = THREE.MathUtils.damp(camera.position.z, 8.4 - scroll * 1.6, 2.4, delta);
  });

  const cfg = CONFIG[quality];
  return (
    <group ref={group}>
      <Nodes graph={graph} segments={cfg.segments} />
      <Edges graph={graph} />
      <Pulses graph={graph} count={cfg.pulses} />
    </group>
  );
}

export default function NetworkScene({ quality, active, scrollProgress }: { quality: Quality; active: boolean; scrollProgress: React.RefObject<number> }) {
  const cfg = CONFIG[quality];
  // Keeps the network clear of the headline, on whichever side the language reads from.
  const shift = typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? -2.7 : 2.7;
  const graph = useMemo(() => buildGraph(cfg.nodes), [cfg.nodes]);
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, cfg.dpr]}
      gl={{ antialias: quality !== 'low', alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 8.4], fov: 42 }}
      aria-hidden
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 5, 6]} intensity={2.4} color={PAPER} />
      <pointLight position={[-5, -2, 2]} intensity={26} color={TILE} />
      <Rig graph={graph} quality={quality} scrollProgress={scrollProgress} shift={shift} />
      <Dust count={cfg.dust} />
    </Canvas>
  );
}
