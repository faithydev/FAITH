'use client';

import { palette } from '@faith/design-tokens';
import { Line } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Quality } from './capability';

const TILE = palette.neon[500];

type Props = {
  count: number; selected: number; onSelect: (i: number) => void; quality: Quality; active: boolean;
};

function layout(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    const y = Math.sin(a * 2) * 0.42;
    return new THREE.Vector3(Math.cos(a) * 2.5, y, Math.sin(a) * 2.5);
  });
}

function Node({ position, selected, onSelect, segments }: { position: THREE.Vector3; selected: boolean; onSelect: () => void; segments: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const target = selected ? 0.3 : hover ? 0.23 : 0.16;
    m.scale.setScalar(THREE.MathUtils.damp(m.scale.x, target, 8, Math.min(dt, 0.05)));
    m.rotation.y += dt * 0.5;
  });
  return (
    <group position={position}>
      <mesh
        ref={ref}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
      >
        <icosahedronGeometry args={[1, segments]} />
        <meshStandardMaterial color={selected ? TILE : '#FFFFFF'} roughness={0.3} metalness={0.6} emissive={selected ? TILE : '#000000'} emissiveIntensity={selected ? 0.5 : 0} />
      </mesh>
      {/* A larger invisible target, so nodes are easy to hit with a finger. */}
      <mesh visible={false} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <sphereGeometry args={[0.46, 8, 8]} />
      </mesh>
    </group>
  );
}

function Rig({ count, selected, onSelect, quality }: Omit<Props, 'active'>) {
  const group = useRef<THREE.Group>(null);
  const points = useMemo(() => layout(count), [count]);
  const target = useRef(0);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    // Turns the ring so the selected node faces the viewer.
    target.current = (selected / count) * Math.PI * 2 + Math.PI;
    let diff = (target.current - g.rotation.y) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    g.rotation.y += diff * Math.min(1, dt * 2.4);
  });

  return (
    <group ref={group} rotation={[0.28, 0, 0]}>
      <mesh>
        <icosahedronGeometry args={[0.62, quality === 'high' ? 3 : 2]} />
        <meshStandardMaterial color={palette.gray[600]} roughness={0.42} metalness={0.35} flatShading />
      </mesh>
      {points.map((p, i) => (
        <group key={i}>
          <Line points={[[0, 0, 0], [p.x, p.y, p.z]]} color={i === selected ? TILE : palette.gray[400]} transparent opacity={i === selected ? 0.9 : 0.22} lineWidth={i === selected ? 1.6 : 1} />
          <Node position={p} selected={i === selected} onSelect={() => onSelect(i)} segments={quality === 'low' ? 1 : 2} />
        </group>
      ))}
    </group>
  );
}

export default function EcosystemScene(props: Props) {
  return (
    <Canvas frameloop={props.active ? 'always' : 'never'} dpr={[1, 1.6]} camera={{ position: [0, 1.3, 6.4], fov: 40 }} gl={{ antialias: props.quality !== 'low', alpha: true }} aria-hidden>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 5]} intensity={2.2} />
      <pointLight position={[-4, -2, 3]} intensity={18} color={TILE} />
      <Rig {...props} />
    </Canvas>
  );
}
