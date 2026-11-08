'use client';

import dynamic from 'next/dynamic';
import { ReactNode, useEffect, useRef } from 'react';
import { useActive, useSceneSupport } from './capability';

const NetworkScene = dynamic(() => import('./network-scene'), { ssr: false });

/** Static artwork for reduced motion or missing WebGL. It carries the same composition. */
function StaticBackdrop() {
  const dots = Array.from({ length: 42 }, (_, i) => {
    const t = i / 42;
    const a = t * Math.PI * 9;
    return { x: 74 + Math.cos(a) * (12 + 12 * Math.sin(t * Math.PI)), y: 52 + (t - 0.5) * 66, r: i % 7 === 0 ? 0.55 : 0.22 };
  });
  return (
    <svg data-testid="hero-fallback" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden className="absolute inset-0 h-full w-full">
      {dots.slice(1).map((d, i) => <line key={i} x1={dots[i]!.x} y1={dots[i]!.y} x2={d.x} y2={d.y} stroke="#7DFFB2" strokeOpacity={0.16} strokeWidth={0.08} />)}
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={i % 7 === 0 ? '#00FF66' : '#FFFFFF'} opacity={0.85} />)}
    </svg>
  );
}

export function ThreeDHero({ children }: { children: ReactNode }) {
  const support = useSceneSupport();
  const [ref, active] = useActive<HTMLDivElement>();
  const scroll = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      scroll.current = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section ref={ref} data-theme="dark" className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-black text-white">
      <div className="absolute inset-0 -z-10">
        {support.state === 'ready' ? <NetworkScene quality={support.quality} active={active} scrollProgress={scroll} /> : support.state === 'static' ? <StaticBackdrop /> : null}
        <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-40 [mask:radial-gradient(70%_60%_at_70%_40%,#000,transparent)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(42%_55%_at_72%_42%,rgba(0,255,102,0.14),transparent_70%)] rtl:scale-x-[-1]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,#000000_4%,transparent_42%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#000000_12%,transparent_58%)] rtl:scale-x-[-1]" />
      </div>
      {children}
    </section>
  );
}
