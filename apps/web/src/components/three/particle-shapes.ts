/**
 * Point clouds for the ecosystem story. Every shape has exactly `n` points, so the scene can
 * morph any shape into any other point by point. `accent` marks the points drawn in neon.
 * Shapes are built from simple primitives and a seeded random generator, so they are identical
 * on every visit and cost nothing to download.
 */

/** `accent`: 0 for the shape, 1 for its lit part, 2 for the faint halo around it. */
export type Shape = { pos: Float32Array; accent: Uint8Array };

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

class Builder {
  pos: Float32Array;
  accent: Uint8Array;
  i = 0;
  constructor(public n: number, public r: () => number) {
    this.pos = new Float32Array(n * 3);
    this.accent = new Uint8Array(n);
  }
  push(x: number, y: number, z: number, accent = false) {
    if (this.i >= this.n) return;
    this.pos[this.i * 3] = x;
    this.pos[this.i * 3 + 1] = y;
    this.pos[this.i * 3 + 2] = z;
    this.accent[this.i] = accent ? 1 : 0;
    this.i++;
  }
  /** Share of the total for one part of a shape. */
  part(share: number) { return Math.round(this.n * share); }
  jitter(a = 0.04) { return (this.r() - 0.5) * a; }
  ring(count: number, cx: number, cy: number, radius: number, width: number, accent = false, z = 0) {
    for (let k = 0; k < count; k++) {
      const t = this.r() * Math.PI * 2;
      const rr = radius + (this.r() - 0.5) * width;
      this.push(cx + Math.cos(t) * rr, cy + Math.sin(t) * rr, z + this.jitter(0.25), accent);
    }
  }
  triangle(count: number, a: number[], b: number[], c: number[], accent = false, depth = 0.25) {
    for (let k = 0; k < count; k++) {
      let u = this.r();
      let v = this.r();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      this.push(a[0]! + (b[0]! - a[0]!) * u + (c[0]! - a[0]!) * v, a[1]! + (b[1]! - a[1]!) * u + (c[1]! - a[1]!) * v, (this.r() - 0.5) * depth, accent);
    }
  }
  segment(count: number, x0: number, y0: number, x1: number, y1: number, thick: number, accent = false) {
    for (let k = 0; k < count; k++) {
      const t = this.r();
      this.push(x0 + (x1 - x0) * t + this.jitter(thick), y0 + (y1 - y0) * t + this.jitter(thick), this.jitter(thick * 1.6), accent);
    }
  }
  /** Points on the surface of a box, weighted by face area. */
  box(count: number, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, accent = false) {
    const areas = [sy * sz, sy * sz, sx * sz, sx * sz, sx * sy, sx * sy];
    const total = areas.reduce((a, b) => a + b, 0);
    for (let k = 0; k < count; k++) {
      let pick = this.r() * total;
      let face = 0;
      while (pick > areas[face]! && face < 5) { pick -= areas[face]!; face++; }
      const u = this.r() - 0.5;
      const v = this.r() - 0.5;
      const s = face % 2 ? 0.5 : -0.5;
      const [x, y, z] = face < 2 ? [s * sx, u * sy, v * sz] : face < 4 ? [u * sx, s * sy, v * sz] : [u * sx, v * sy, s * sz];
      this.push(cx + x, cy + y, cz + z, accent);
    }
  }
  sphere(count: number, cx: number, cy: number, cz: number, radius: number, accent = false) {
    for (let k = 0; k < count; k++) {
      const u = this.r() * 2 - 1;
      const t = this.r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const rr = radius * (0.92 + this.r() * 0.08);
      this.push(cx + s * Math.cos(t) * rr, cy + u * rr, cz + s * Math.sin(t) * rr, accent);
    }
  }
  /** A coin: two faces and an edge. */
  coin(count: number, cx: number, cy: number, cz: number, radius: number, height: number, accent = false) {
    for (let k = 0; k < count; k++) {
      const t = this.r() * Math.PI * 2;
      if (this.r() < 0.35) {
        this.push(cx + Math.cos(t) * radius, cy + (this.r() - 0.5) * height, cz + Math.sin(t) * radius, accent);
      } else {
        const rr = Math.sqrt(this.r()) * radius;
        this.push(cx + Math.cos(t) * rr, cy + (this.r() < 0.5 ? -0.5 : 0.5) * height, cz + Math.sin(t) * rr, accent);
      }
    }
  }
  /** Turns every point pushed since index `from` around X, then Y, so a flat shape shows depth. */
  rotate(from: number, rx: number, ry: number) {
    const [cx, sx, cy, sy] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry)];
    for (let i = from; i < this.i; i++) {
      const x = this.pos[i * 3]!;
      const y = this.pos[i * 3 + 1]!;
      const z = this.pos[i * 3 + 2]!;
      const y1 = y * cx - z * sx;
      const z1 = y * sx + z * cx;
      this.pos[i * 3] = x * cy + z1 * sy;
      this.pos[i * 3 + 1] = y1;
      this.pos[i * 3 + 2] = -x * sy + z1 * cy;
    }
  }
  /** Fill whatever is left with a faint halo, so every shape has exactly n points. */
  finish(radius = 3.2): Shape {
    while (this.i < this.n) {
      const u = this.r() * 2 - 1;
      const t = this.r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const rr = radius * (0.75 + this.r() * 0.6);
      this.push(s * Math.cos(t) * rr, u * rr * 0.7, s * Math.sin(t) * rr - 1.2);
      this.accent[this.i - 1] = 2;
    }
    return { pos: this.pos, accent: this.accent };
  }
}

type Make = (b: Builder) => Shape;

/** Creators: a play symbol inside a lens ring. Content that earns. */
const creators: Make = (b) => {
  b.ring(b.part(0.42), 0, 0, 1.85, 0.16);
  b.ring(b.part(0.08), 0, 0, 2.25, 0.04);
  b.triangle(b.part(0.38), [-0.55, -0.85], [-0.55, 0.85], [0.95, 0], true);
  return b.finish();
};

/** Customers: a shopping bag with its handle lit. */
const customers: Make = (b) => {
  const body = b.part(0.62);
  for (let k = 0; k < body; k++) {
    const y = -1.5 + b.r() * 2.3;
    const half = 1.1 + (y + 1.5) * 0.08;
    const edge = b.r() < 0.4;
    const x = edge ? (b.r() < 0.5 ? -half : half) + b.jitter(0.05) : (b.r() - 0.5) * 2 * half;
    b.push(x, y, edge ? b.jitter(0.6) : (b.r() < 0.5 ? -0.3 : 0.3));
  }
  const handle = b.part(0.26);
  for (let k = 0; k < handle; k++) {
    const t = b.r() * Math.PI;
    b.push(Math.cos(t) * 0.62, 0.8 + Math.sin(t) * 0.75, b.jitter(0.08), true);
  }
  return b.finish();
};

/** Developers: </> drawn in light, the slash in neon. */
const developers: Make = (b) => {
  const c = b.part(0.2);
  b.segment(c, -0.9, 0.95, -1.9, 0, 0.09);
  b.segment(c, -1.9, 0, -0.9, -0.95, 0.09);
  b.segment(c, 0.9, 0.95, 1.9, 0, 0.09);
  b.segment(c, 1.9, 0, 0.9, -0.95, 0.09);
  b.segment(b.part(0.13), 0.42, 1.3, -0.42, -1.3, 0.1, true);
  return b.finish();
};

/** Businesses: rising bars, the same idea as the FAITH mark. The tallest is lit. */
const businesses: Make = (b) => {
  const heights = [0.8, 1.3, 1.85, 2.45, 3.1];
  const per = b.part(0.17);
  heights.forEach((h, i) => b.box(per, -1.8 + i * 0.9, -1.55 + h / 2, 0, 0.5, h, 0.5, i === heights.length - 1));
  return b.finish();
};

/** Products: a parcel, with a neon ribbon around it. */
const products: Make = (b) => {
  b.box(b.part(0.6), 0, 0, 0, 2.2, 2.2, 2.2);
  const ribbon = b.part(0.28);
  for (let k = 0; k < ribbon; k++) {
    const t = b.r() * 4 - 2;
    const w = (b.r() - 0.5) * 0.26;
    const face = Math.floor(b.r() * 4);
    const pts = [[t * 0.55, 1.11, w], [t * 0.55, -1.11, w], [1.11, t * 0.55, w], [-1.11, t * 0.55, w]][face]!;
    b.push(pts[0]!, pts[1]!, pts[2]!, true);
  }
  // Seen from above and to the side, so it reads as a box, not a square.
  b.rotate(0, 0.5, 0.65);
  return b.finish();
};

/** Communities: people around a shared centre. */
const communities: Make = (b) => {
  b.sphere(b.part(0.2), 0, 0, 0, 0.62, true);
  const around = b.part(0.09);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    b.sphere(around, Math.cos(a) * 2, Math.sin(a) * 1.35, Math.sin(a * 2) * 0.4, 0.34);
  }
  const links = b.part(0.012);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    b.segment(links, 0, 0, Math.cos(a) * 2, Math.sin(a) * 1.35, 0.02, true);
  }
  return b.finish();
};

/** Rewards: a stack of coins, the top one lit. */
const rewards: Make = (b) => {
  // A stack of coins drawn by their rims, tilted toward the viewer; the top coin is lit.
  const rim = b.part(0.075);
  for (let i = 0; i < 6; i++) {
    const y = -1.25 + i * 0.26;
    const x = -1.05 + (i % 2 ? 0.06 : -0.04);
    for (let k = 0; k < rim; k++) {
      const t = b.r() * Math.PI * 2;
      b.push(x + Math.cos(t) * 0.95, y + (b.r() - 0.5) * 0.12, Math.sin(t) * 0.95, i === 5);
    }
  }
  const top = b.part(0.06);
  for (let k = 0; k < top; k++) {
    const t = b.r() * Math.PI * 2;
    const rr = Math.sqrt(b.r()) * 0.95;
    b.push(-1.05 + Math.cos(t) * rr, 0.08, Math.sin(t) * rr, true);
  }
  b.rotate(0, 0.42, 0);
  // One large coin standing beside the stack, facing us: a face, a raised inner ring, a lit rim.
  const face = b.part(0.17);
  for (let k = 0; k < face; k++) {
    const t = b.r() * Math.PI * 2;
    const rr = Math.sqrt(b.r()) * 1.15;
    b.push(1.25 + Math.cos(t) * rr, 0.15 + Math.sin(t) * rr, (b.r() - 0.5) * 0.12);
  }
  b.ring(b.part(0.06), 1.25, 0.15, 0.78, 0.05, false, 0.08);
  b.ring(b.part(0.09), 1.25, 0.15, 1.17, 0.07, true);
  // Sparks rising off the stack.
  for (let k = 0, sparks = b.part(0.04); k < sparks; k++) b.push(-1.05 + (b.r() - 0.5) * 1.4, 0.5 + b.r() * 1.5, (b.r() - 0.5) * 0.6, true);
  return b.finish();
};

/** Applications: a grid of app tiles, two of them installed (lit). */
const applications: Make = (b) => {
  const per = b.part(0.098);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      b.box(per, -1.45 + c * 1.45, 1.45 - r * 1.45, 0, 1.05, 1.05, 0.18, (r === 1 && c === 1) || (r === 0 && c === 2));
    }
  }
  return b.finish();
};

/** Fallback for an unknown key: a calm sphere. */
const sphere: Make = (b) => { b.sphere(b.part(0.9), 0, 0, 0, 1.9); return b.finish(); };

const MAKERS: Record<string, Make> = { creators, customers, developers, businesses, products, communities, rewards, applications };

export function buildShapes(keys: string[], n: number): Shape[] {
  return keys.map((k, i) => (MAKERS[k] ?? sphere)(new Builder(n, rng(1107 + i * 97))));
}
