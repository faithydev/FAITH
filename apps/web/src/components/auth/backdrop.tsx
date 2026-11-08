'use client';

import { useEffect, useRef } from 'react';
import { useActive, useSceneSupport } from '../three/capability';

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

/**
 * Ribbons of green light that roll like waves under the sign-in card and swell toward the
 * pointer. One fragment shader: no textures, no libraries, only the brand's black and greens.
 */
const FRAG = `
precision highp float;
uniform vec2 r;
uniform float t;
uniform vec2 m;
uniform float mOn;
float wave(float x, float base, float amp, float freq, float speed, float phase, float bump) {
  return base
    + (amp + bump) * sin(x * freq + t * speed + phase)
    + amp * 0.55 * sin(x * freq * 1.87 - t * speed * 1.31 + phase * 1.9)
    + amp * 0.25 * sin(x * freq * 3.1 + t * speed * 0.7 + phase * 0.6);
}
void main(){
  vec2 uv = gl_FragCoord.xy / r;
  float ar = r.x / r.y;
  float x = uv.x * ar;
  vec3 neon = vec3(0.0, 1.0, 0.4);
  vec3 mint = vec3(0.62, 1.0, 0.8);
  vec3 deep = vec3(0.0, 0.42, 0.18);
  vec3 col = vec3(0.0);
  float lowest = 1.0;
  // Near the pointer the waves rise a little, as if pushed.
  float near = mOn * exp(-pow((uv.x - m.x) * 3.2, 2.0)) * 0.05;
  for (int i = 0; i < 7; i++) {
    float f = float(i) / 6.0;
    float y = wave(x, 0.2 + f * 0.2, 0.035 + f * 0.022, 2.1 + f * 1.3, 0.32 + f * 0.16, f * 5.3, near * (1.0 - f * 0.5));
    lowest = min(lowest, y);
    float d = abs(uv.y - y);
    float core = exp(-d * mix(520.0, 260.0, f));
    float glow = exp(-d * 26.0) * 0.16;
    vec3 c = mix(neon, mint, f * 0.85);
    // Each ribbon brightens where it crests.
    float crest = 0.55 + 0.45 * sin(x * (1.6 + f) - t * (0.5 + f * 0.3) + f * 4.0);
    col += c * (core * (0.55 + 0.6 * crest) + glow * crest) * (0.55 + 0.45 * f);
  }
  // The water under the waves: a deep green that darkens with depth.
  float below = smoothstep(0.0, 0.02, lowest - uv.y);
  col += deep * below * (0.16 + 0.22 * smoothstep(0.0, lowest, uv.y));
  // A faint haze above the crests.
  col += neon * exp(-max(uv.y - 0.42, 0.0) * 9.0) * 0.035;
  // Keep the middle calm behind the form, and the corners dark.
  vec2 q = (uv - vec2(0.5, 0.52)) * vec2(ar * 0.9, 1.0);
  col *= mix(0.5, 1.0, smoothstep(0.06, 0.5, length(q)));
  col *= smoothstep(1.3, 0.35, length((uv - vec2(0.5, 0.4)) * vec2(ar * 0.6, 1.0)));
  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
}

const wavePath = (base: number, amp: number, phase: number) => {
  let d = `M0 ${base}`;
  for (let x = 0; x <= 1600; x += 40) d += ` L${x} ${(base + Math.sin(x / 160 + phase) * amp + Math.sin(x / 83 - phase) * amp * 0.4).toFixed(1)}`;
  return d;
};

/** The same scene without WebGL: layered wave lines in SVG, greens only. */
function StaticWaves() {
  return (
    <svg data-testid="auth-fallback" aria-hidden viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="auth-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#00FF66" stopOpacity="0.14" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${wavePath(660, 26, 0)} L1600 900 L0 900 Z`} fill="url(#auth-sea)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={wavePath(560 + i * 34, 22 + i * 6, i * 1.3)} fill="none" stroke={i % 2 ? '#7DFFB2' : '#00FF66'} strokeOpacity={0.35 + i * 0.1} strokeWidth={1.4} />
      ))}
    </svg>
  );
}

export function AuthBackdrop() {
  const support = useSceneSupport();
  const [wrap, active] = useActive<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef(active);
  live.current = active;

  useEffect(() => {
    if (support.state !== 'ready' && !(support.state === 'static' && support.reason === 'motion')) return;
    const el = canvas.current;
    const gl = el?.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!el || !gl) return;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, 'r');
    const uT = gl.getUniformLocation(prog, 't');
    const uM = gl.getUniformLocation(prog, 'm');
    const uOn = gl.getUniformLocation(prog, 'mOn');

    // The pointer, eased so the waves follow it softly instead of jumping.
    const pointer = { x: 0.5, tx: 0.5, on: 0, ton: 0 };
    const onMove = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      pointer.tx = (e.clientX - b.left) / b.width;
      pointer.ton = 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const quality = support.state === 'ready' ? support.quality : 'low';
    const dpr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.5 : 1);
    const resize = () => {
      el.width = Math.round(el.clientWidth * dpr);
      el.height = Math.round(el.clientHeight * dpr);
      gl.viewport(0, 0, el.width, el.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const draw = (time: number) => {
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.on += (pointer.ton - pointer.on) * 0.04;
      gl.uniform2f(uR, el.width, el.height);
      gl.uniform1f(uT, time);
      gl.uniform2f(uM, pointer.x, 0.5);
      gl.uniform1f(uOn, pointer.on);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const stop = () => { ro.disconnect(); window.removeEventListener('pointermove', onMove); };
    // Reduced motion: one still frame, the composition without the movement.
    if (support.state === 'static') {
      draw(12);
      return stop;
    }
    let frame = 0;
    let last = 0;
    const begin = performance.now();
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (!live.current || now - last < 33) return;
      last = now;
      draw(12 + (now - begin) / 1000);
    };
    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); stop(); };
  }, [support]);

  return (
    <div ref={wrap} aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-black">
      {support.state === 'static' && support.reason === 'webgl' ? <StaticWaves /> : <canvas ref={canvas} className="h-full w-full" />}
    </div>
  );
}
