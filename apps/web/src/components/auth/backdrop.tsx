'use client';

import { useEffect, useRef } from 'react';
import { useActive, useSceneSupport } from '../three/capability';

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

/**
 * A dark planet edge with green light rising off it. Pure maths in one fragment shader:
 * no textures, no libraries, a few hundred bytes over the wire.
 */
const FRAG = `
precision highp float;
uniform vec2 r;
uniform float t;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / r;
  float ar = r.x / r.y;
  // The limb of the planet: high on the left, low past the middle, lifting again at the right.
  float hy = 0.5 - 0.17 * smoothstep(0.0, 0.66, uv.x) + 0.04 * smoothstep(0.66, 1.0, uv.x);
  float d = (uv.y - hy);
  float above = step(0.0, d);
  float side = smoothstep(0.2, 1.0, uv.x);
  float n = fbm(vec2(uv.x * 2.4 * ar * 0.6 - t * 0.035, d * 3.2 - t * 0.06));
  float h = d - n * 0.09 * side;
  float curtain = exp(-max(h, 0.0) * mix(26.0, 3.4, side)) * above;
  float bands = 0.6 + 0.4 * sin(h * 32.0 + n * 6.5 - t * 0.4 + uv.x * 3.0);
  vec3 neon = vec3(0.0, 1.0, 0.4);
  vec3 lime = vec3(0.74, 1.0, 0.2);
  vec3 teal = vec3(0.0, 0.78, 0.6);
  vec3 col = mix(neon, lime, smoothstep(0.03, 0.22, h + 0.06 * sin(uv.x * 9.0 + t * 0.2)));
  col = mix(col, teal, smoothstep(0.2, 0.55, h));
  float rim = exp(-abs(d) * mix(260.0, 120.0, side)) * (0.45 + 0.9 * side);
  vec3 o = col * curtain * bands * (0.12 + 1.35 * side);
  o += vec3(0.62, 1.0, 0.8) * rim;
  o += neon * exp(-max(d, 0.0) * 34.0) * 0.08 * above;
  // Quiet the middle, where the form sits, and the far corners.
  vec2 q = (uv - vec2(0.5, 0.52)) * vec2(ar * 0.9, 1.0);
  o *= mix(0.55, 1.0, smoothstep(0.08, 0.55, length(q)));
  o *= smoothstep(1.35, 0.4, length((uv - 0.5) * vec2(ar * 0.65, 1.0)));
  gl_FragColor = vec4(o, 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
}

/** The same scene as a gradient, for no WebGL. */
function StaticHorizon() {
  return (
    <div data-testid="auth-fallback" aria-hidden className="absolute inset-0" style={{
      background: [
        'radial-gradient(60% 40% at 85% 58%, rgba(0,255,102,0.38), transparent 70%)',
        'radial-gradient(40% 26% at 70% 62%, rgba(184,255,60,0.22), transparent 70%)',
        'linear-gradient(176deg, transparent 49.6%, rgba(160,255,200,0.7) 50%, transparent 50.6%)',
        '#000',
      ].join(','),
    }} />
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
      gl.uniform2f(uR, el.width, el.height);
      gl.uniform1f(uT, time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    // Reduced motion: one still frame, the composition without the movement.
    if (support.state === 'static') {
      draw(12);
      return () => ro.disconnect();
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
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
  }, [support]);

  return (
    <div ref={wrap} aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-black">
      {support.state === 'static' && support.reason === 'webgl' ? <StaticHorizon /> : <canvas ref={canvas} className="h-full w-full" />}
    </div>
  );
}
