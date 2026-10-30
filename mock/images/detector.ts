import type { ThumbStyle } from "../types";

// Thumbnails drawn from the physics each technique measures, the way a facility's reduction software shows them:
// a SANS detector image in log counts with its beamstop, a refined powder pattern, a reflectivity curve, Laue spots, an S(Q,E) map…
// Every seed gives different parameters (sizes, lattices, layers, noise), so no two datasets look alike.

const W = 640;
const H = 400;
type RGB = [number, number, number];

function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
};
const poisson = (r: () => number, lam: number) => {
  if (lam <= 0) return 0;
  if (lam > 30) return Math.max(0, Math.round(lam + Math.sqrt(lam) * gauss(r)));
  const L = Math.exp(-lam);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L);
  return k - 1;
};
const range = (r: () => number, a: number, b: number) => a + (b - a) * r();
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)]!;

// ---- colour maps (the ones Mantid, Python and the instrument GUIs use)
const VIRIDIS: RGB[] = [[68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142], [38, 130, 142], [31, 158, 137], [53, 183, 121], [109, 205, 89], [180, 222, 44], [253, 231, 37]];
const INFERNO: RGB[] = [[0, 0, 4], [31, 12, 72], [85, 15, 109], [136, 34, 106], [186, 54, 85], [227, 89, 51], [249, 140, 10], [249, 201, 50], [252, 255, 164]];
const JET: RGB[] = [[0, 0, 143], [0, 0, 255], [0, 128, 255], [0, 255, 255], [128, 255, 128], [255, 255, 0], [255, 128, 0], [255, 0, 0], [128, 0, 0]];
const MAPS = { viridis: VIRIDIS, inferno: INFERNO, jet: JET };

function mapColour(stops: RGB[], t: number): RGB {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = stops[i]!;
  const b = stops[i + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function makeCanvas() {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  return { c, ctx: c.getContext("2d")! };
}
const finish = (c: HTMLCanvasElement) => c.toDataURL("image/jpeg", 0.9);

// paint a float image through a colour map; NaN = masked (drawn `mask`)
function paint(ctx: CanvasRenderingContext2D, vals: Float32Array, w: number, h: number, ox: number, oy: number, stops: RGB[], lo: number, hi: number, mask: RGB = [0, 0, 0]) {
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i]!;
    const col = Number.isNaN(v) ? mask : mapColour(stops, (v - lo) / (hi - lo));
    img.data[i * 4] = col[0];
    img.data[i * 4 + 1] = col[1];
    img.data[i * 4 + 2] = col[2];
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, ox, oy);
}

// ---- axes for the plot-style images
const FONT = "11px Inter, system-ui, sans-serif";
function niceTicks(lo: number, hi: number, n = 6) {
  const span = hi - lo;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
interface Frame { l: number; t: number; w: number; h: number }
function frame(ctx: CanvasRenderingContext2D, bg: string, xlab: string, ylab: string, xr: [number, number], yr: [number, number], opt: { logY?: boolean; noYTicks?: boolean } = {}): Frame {
  const f: Frame = { l: 62, t: 16, w: W - 62 - 18, h: H - 16 - 46 };
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(f.l, f.t, f.w, f.h);
  ctx.font = FONT;
  ctx.fillStyle = "#334155";
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  const X = (v: number) => f.l + ((v - xr[0]) / (xr[1] - xr[0])) * f.w;
  for (const v of niceTicks(xr[0], xr[1], 7)) {
    ctx.beginPath(); ctx.moveTo(X(v), f.t); ctx.lineTo(X(v), f.t + f.h); ctx.stroke();
    ctx.textAlign = "center"; ctx.fillText(String(v), X(v), f.t + f.h + 15);
  }
  if (opt.logY) {
    for (let e = Math.ceil(yr[0]); e <= yr[1]; e++) {
      const y = f.t + f.h - ((e - yr[0]) / (yr[1] - yr[0])) * f.h;
      ctx.beginPath(); ctx.moveTo(f.l, y); ctx.lineTo(f.l + f.w, y); ctx.stroke();
      ctx.textAlign = "right"; ctx.fillText(`1e${e}`, f.l - 6, y + 4);
    }
  } else if (!opt.noYTicks) {
    for (const v of niceTicks(yr[0], yr[1], 6)) {
      const y = f.t + f.h - ((v - yr[0]) / (yr[1] - yr[0])) * f.h;
      ctx.beginPath(); ctx.moveTo(f.l, y); ctx.lineTo(f.l + f.w, y); ctx.stroke();
      ctx.textAlign = "right"; ctx.fillText(v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(+v.toFixed(2)), f.l - 6, y + 4);
    }
  }
  ctx.strokeStyle = "#475569";
  ctx.strokeRect(f.l + 0.5, f.t + 0.5, f.w, f.h);
  ctx.fillStyle = "#475569";
  ctx.textAlign = "center";
  ctx.fillText(xlab, f.l + f.w / 2, H - 8);
  ctx.save();
  ctx.translate(14, f.t + f.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(ylab, 0, 0);
  ctx.restore();
  return f;
}

// ================= SANS: a 2D detector image in log counts, beamstop and its arm masked, a few dead tubes
function sans(seed: number) {
  const r = rng(seed);
  const { c, ctx } = makeCanvas();
  // computed at half size and shown with hard pixels, like a detector image: four times less work
  const w = W / 2;
  const h = H / 2;
  const cx = w / 2 + range(r, -8, 8);
  const cy = h / 2 + range(r, -5, 5);
  const qpp = range(r, 0.0022, 0.0048);
  const kind = pick(r, ["spheres", "spheres", "peak", "lobes", "powerlaw"] as const);
  const R = range(r, 45, 160);
  const sigma = range(r, 0.06, 0.2);
  const q0 = range(r, 0.04, 0.16);
  const phi0 = r() * Math.PI;
  const aniso = range(r, 0.5, 0.95);
  const n = range(r, 2.2, 4);
  const A = 10 ** range(r, 3.6, 4.6);
  const bg = 10 ** range(r, 0.2, 1.1);
  const armDir = pick(r, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  const bsR = range(r, 5.5, 10);
  const gaps = [Math.round(w * range(r, 0.28, 0.36)), Math.round(w * range(r, 0.64, 0.72))];
  const dead = Array.from({ length: 3 + Math.floor(r() * 6) }, () => Math.floor(r() * W));
  const vals = new Float32Array(w * h);
  let hi = 0;
  const ff = (x: number) => {
    if (x < 1e-3) return 1;
    const f = (3 * (Math.sin(x) - x * Math.cos(x))) / x ** 3;
    return f * f;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const rad = Math.hypot(dx, dy);
      const q = rad * qpp;
      const phi = Math.atan2(dy, dx);
      let I = 0;
      if (kind === "spheres") {
        for (let k = -1; k <= 1; k++) I += ff(q * R * (1 + sigma * k * 0.9)) * Math.exp(-0.5 * (k / 1.1) ** 2);
        I = (A * I) / 2.2 + (A * 0.002) / (q ** n + 1e-4);
      } else if (kind === "peak") {
        I = A * 0.12 / (1 + (q / 0.015) ** n) + A * 0.7 * Math.exp(-0.5 * ((q - q0) / (q0 * 0.12)) ** 2) + A * 0.1 * Math.exp(-0.5 * ((q - 2 * q0) / (q0 * 0.16)) ** 2);
      } else if (kind === "lobes") {
        const ang = 1 + aniso * Math.cos(2 * (phi - phi0));
        I = (A * 0.25) / (1 + (q / 0.012) ** n) * ang + A * 0.6 * Math.exp(-0.5 * ((q - q0) / (q0 * 0.14)) ** 2) * ang ** 2;
      } else {
        I = (A * 0.01) / (q ** n + 3e-4) + A * 0.02 * Math.exp(-q * 40);
      }
      let v = poisson(r, I + bg);
      v = Math.log10(Math.max(1, v));
      const along = dx * Math.cos(armDir) + dy * Math.sin(armDir);
      const across = -dx * Math.sin(armDir) + dy * Math.cos(armDir);
      const inStop = rad < bsR || (along > 0 && Math.abs(across) < 2.3);
      const dark = gaps.some((g) => Math.abs(x - g) < 0.8) || dead.includes(x);
      vals[y * w + x] = inStop ? NaN : dark ? 0 : v;
      if (!inStop && v > hi) hi = v;
    }
  }
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  paint(tmp.getContext("2d")!, vals, w, h, 0, 0, MAPS[pick(r, ["viridis", "viridis", "jet"] as const)], 0, Math.max(2.5, hi));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, W, H);
  return finish(c);
}

// ================= Single-crystal: Bragg spots of a reciprocal lattice on a dark detector, with sample-environment Debye lines
function single(seed: number) {
  const r = rng(seed);
  const { c, ctx } = makeCanvas();
  const vals = new Float32Array(W * H);
  const cx = W / 2 + range(r, -30, 30);
  const cy = H / 2 + range(r, -20, 20);
  const th = r() * Math.PI;
  const la = range(r, 34, 62);
  const lb = range(r, 34, 62);
  const gam = range(r, 1.25, 1.9);
  const ax = Math.cos(th) * la;
  const ay = Math.sin(th) * la;
  const bx = Math.cos(th + gam) * lb;
  const by = Math.sin(th + gam) * lb;
  const sx = range(r, 1.6, 3.2);
  const sy = range(r, 1.6, 3.2);
  const absent = r() * 0.3;
  for (let i = -16; i <= 16; i++) {
    for (let j = -16; j <= 16; j++) {
      if ((i === 0 && j === 0) || r() < absent) continue;
      const x = cx + i * ax + j * bx + gauss(r) * 0.6;
      const y = cy + i * ay + j * by + gauss(r) * 0.6;
      if (x < 3 || y < 3 || x > W - 3 || y > H - 3) continue;
      const d = Math.hypot(x - cx, y - cy);
      const amp = Math.exp(gauss(r) * 0.9) * 120 * Math.exp(-d / 260);
      const rx = Math.ceil(sx * 4);
      const ry = Math.ceil(sy * 4);
      for (let yy = Math.max(0, Math.floor(y - ry)); yy < Math.min(H, y + ry); yy++) {
        for (let xx = Math.max(0, Math.floor(x - rx)); xx < Math.min(W, x + rx); xx++) {
          vals[yy * W + xx]! += amp * Math.exp(-0.5 * (((xx - x) / sx) ** 2 + ((yy - y) / sy) ** 2));
        }
      }
    }
  }
  const ringR = [range(r, 90, 130), range(r, 150, 210)];
  let hi = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy);
      let v = vals[y * W + x]! + 2.5 + 8 * Math.exp(-d / 90);
      for (const rr of ringR) v += 9 * Math.exp(-0.5 * ((d - rr) / 2.2) ** 2);
      v = poisson(r, v);
      vals[y * W + x] = d < 9 ? NaN : v;
      if (v > hi) hi = v;
    }
  }
  const out = new Float32Array(vals.length);
  for (let i = 0; i < vals.length; i++) out[i] = Math.sqrt(vals[i]!);
  paint(ctx, out, W, H, 0, 0, INFERNO, 0, Math.sqrt(hi) * 0.8);
  return finish(c);
}

// ================= MX: a neutron Laue pattern, dense radial spots on a circular image plate, shown as a negative
function laue(seed: number) {
  const r = rng(seed);
  const { c, ctx } = makeCanvas();
  const vals = new Float32Array(W * H);
  const cx = W / 2;
  const cy = H / 2;
  const R = H / 2 - 6;
  const n = Math.floor(range(r, 500, 1100));
  const halo = range(r, 0.45, 0.75) * R;
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2;
    const d = R * Math.sqrt(r()) * 0.98;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const amp = 10 ** range(r, 0.2, 1.4) * (1 - 0.55 * (d / R));
    const sr = range(r, 2.4, 3.8) * (1 + d / R);
    const st = range(r, 1.3, 2.1);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const rad = Math.ceil(sr * 3.5);
    for (let yy = Math.max(0, Math.floor(y - rad)); yy < Math.min(H, y + rad); yy++) {
      for (let xx = Math.max(0, Math.floor(x - rad)); xx < Math.min(W, x + rad); xx++) {
        const u = (xx - x) * ca + (yy - y) * sa;
        const v = -(xx - x) * sa + (yy - y) * ca;
        vals[yy * W + xx]! += amp * Math.exp(-0.5 * ((u / sr) ** 2 + (v / st) ** 2));
      }
    }
  }
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const i = y * W + x;
      let g: number;
      if (d > R) g = 38;
      else {
        const v = vals[i]! + 1.2 + 1.6 * Math.exp(-0.5 * ((d - halo) / 38) ** 2) + gauss(r) * 0.35;
        g = 232 - 225 * (1 - Math.exp(-v / 7));
        g -= (d / R) ** 6 * 20;
      }
      img.data[i * 4] = g;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = g * 0.98;
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c);
}

// ================= Imaging: a neutron radiograph, either a Li-ion cell slice (jelly roll) or a porous-rock core with water
function radiograph(seed: number) {
  const r = rng(seed);
  const { c, ctx } = makeCanvas();
  const img = ctx.createImageData(W, H);
  const cx = W / 2 + range(r, -20, 20);
  const cy = H / 2;
  const cell = r() < 0.55;
  const pitch = range(r, 9, 15);
  const phase = r() * 6.28;
  const Rc = range(r, 150, 180);
  const pores = Array.from({ length: 60 }, () => ({ x: range(r, -90, 90), y: range(r, -170, 170), s: range(r, 4, 20), a: range(r, 0.1, 0.4) }));
  const crack = r() * 40 - 20;
  const gain = range(r, 0.9, 1.0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const rad = Math.hypot(dx, dy);
      let T = 0.9 + 0.04 * Math.exp(-((rad / 380) ** 2)) - 0.05 * (x / W);
      if (cell) {
        if (rad < Rc) {
          const spiral = (rad / pitch + Math.atan2(dy, dx) / (2 * Math.PI) + phase) % 1;
          T = 0.5 + 0.16 * Math.cos(spiral * 2 * Math.PI) - 0.12 * Math.exp(-(((Rc - rad) / 6) ** 2)) + 0.28 * Math.exp(-((rad / 12) ** 2));
          if (rad < 14) T += 0.12;
        } else if (rad < Rc + 7) T = 0.34;
      } else if (Math.abs(dx) < 95 + 6 * Math.sin(y / 33) && Math.abs(dy) < 175) {
        T = 0.66 + 0.04 * Math.sin(x / 11 + y / 29);
        for (const p of pores) T -= p.a * Math.exp(-0.5 * (((dx - p.x) / p.s) ** 2 + ((dy - p.y) / p.s) ** 2));
        T -= 0.18 * Math.exp(-0.5 * ((dx - crack - dy * 0.12) / 2.4) ** 2);
        if (Math.abs(Math.abs(dx) - 95) < 4) T -= 0.16;
      }
      T = T * gain + gauss(r) * 0.022;
      const g = Math.max(0, Math.min(1, T)) * 255;
      const i = (y * W + x) * 4;
      img.data[i] = g;
      img.data[i + 1] = g;
      img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // scale bar, as on the viewer
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(W - 110, H - 24, 90, 3);
  ctx.font = FONT;
  ctx.textAlign = "right";
  ctx.fillText(`${pick(r, [5, 10, 20])} mm`, W - 20, H - 30);
  return finish(c);
}

// ================= Inelastic maps: S(Q,E), magnon branches under the kinematic limit, or a quasielastic S(Q,w)
function sqw(seed: number) {
  const r = rng(seed);
  const { c, ctx } = makeCanvas();
  const Ei = range(r, 25, 80);
  const eMax = Ei * 0.85;
  const qMax = range(r, 4.5, 6.5);
  const f = frame(ctx, "#f8fafc", "Q (Å⁻¹)", "Energy transfer (meV)", [0, +qMax.toFixed(1)], [-8, +eMax.toFixed(0)]);
  const branches = Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ D: range(r, 1, 6), J: range(r, 6, eMax * 0.45), a: range(r, 2.2, 4.8), g: range(r, 0.6, 2.2), A: range(r, 0.4, 1) }));
  const w = f.w;
  const h = f.h;
  const vals = new Float32Array(w * h);
  const ki = Math.sqrt(Ei / 2.0721);
  let hi = 0;
  for (let yy = 0; yy < h; yy++) {
    const E = eMax - (yy / h) * (eMax + 8) + 0;
    const Eps = E;
    for (let xx = 0; xx < w; xx++) {
      const Q = (xx / w) * qMax;
      const kf2 = (Ei - Eps) / 2.0721;
      const allowed = kf2 > 0 && Q >= Math.abs(ki - Math.sqrt(kf2)) && Q <= ki + Math.sqrt(kf2);
      if (!allowed) { vals[yy * w + xx] = NaN; continue; }
      let I = 0.4 + 14 * Math.exp(-0.5 * (Eps / 0.55) ** 2) * (1 + 1.4 * Math.exp(-0.5 * ((Q % 1.7) - 0.0) ** 2 / 0.02));
      for (const b of branches) {
        const Eq = b.D + b.J * Math.abs(Math.sin((Math.PI * Q) / b.a));
        I += b.A * 9 * Math.exp(-0.5 * ((Eps - Eq) / (b.g + 0.04 * Eps)) ** 2) * Math.exp(-Q * 0.32);
      }
      I *= 1 + 0.4 * Math.exp(-Eps / 12);
      const v = poisson(r, I);
      vals[yy * w + xx] = v;
      if (v > hi) hi = v;
    }
  }
  paint(ctx, vals, w, h, f.l, f.t, VIRIDIS, 0, hi * 0.55, [255, 255, 255]);
  return finish(c);
}

function qens(seed: number) {
  const r = rng(seed);
  const { c, ctx } = makeCanvas();
  const wMax = range(r, 80, 160);
  const f = frame(ctx, "#f8fafc", "Q (Å⁻¹)", "ħω (µeV)", [0.2, 1.9], [-wMax, wMax]);
  const D = range(r, 0.08, 0.5);
  const tau = range(r, 0.4, 2);
  const res = range(r, 2.5, 4.5);
  const eisf0 = range(r, 0.1, 0.5);
  const w = f.w;
  const h = f.h;
  const vals = new Float32Array(w * h);
  let hi = 0;
  for (let yy = 0; yy < h; yy++) {
    const om = wMax - (yy / h) * 2 * wMax;
    for (let xx = 0; xx < w; xx++) {
      const Q = 0.2 + (xx / w) * 1.7;
      const G = 6.6 * ((D * Q * Q) / (1 + D * Q * Q * tau)) * 4 + res;
      const eisf = eisf0 + (1 - eisf0) * Math.exp(-((Q * 1.4) ** 2) / 3);
      const el = eisf * Math.exp(-0.5 * (om / res) ** 2) / res;
      const lor = (1 - eisf) * (G / Math.PI) / (om * om + G * G);
      const I = 6000 * (el + lor) * Math.exp(-Q * 0.25) + 0.6;
      const v = Math.log10(1 + poisson(r, I));
      vals[yy * w + xx] = v;
      if (v > hi) hi = v;
    }
  }
  paint(ctx, vals, w, h, f.l, f.t, VIRIDIS, 0.2, hi);
  return finish(c);
}

// ================= Powder diffraction: observed counts, calculated profile, difference and reflection ticks (a refinement plot)
function powder(seed: number) {
  const r = rng(seed);
  const { c, ctx } = makeCanvas();
  const lattice = pick(r, ["fcc", "bcc", "sc"] as const);
  const a = range(r, 3.4, 9.5);
  const dmin = range(r, 0.45, 0.8);
  const dmax = range(r, 2.4, 3.6);
  const peaks: { d: number; I: number; w: number }[] = [];
  for (let h = 0; h <= 12; h++) for (let k = 0; k <= h; k++) for (let l = 0; l <= k; l++) {
    const N = h * h + k * k + l * l;
    if (!N) continue;
    const ok = lattice === "sc" || (lattice === "bcc" && (h + k + l) % 2 === 0) || (lattice === "fcc" && (h % 2 === k % 2) && (k % 2 === l % 2));
    if (!ok) continue;
    const d = a / Math.sqrt(N);
    if (d < dmin || d > dmax) continue;
    const mult = (h === k ? 1 : 2) * (k === l ? 1 : 2) * (l ? 2 : 1) * 3;
    peaks.push({ d, I: mult * range(r, 0.3, 1.6) * Math.exp(-0.12 / (d * d)) * d ** 1.4, w: d * range(r, 0.0035, 0.007) });
  }
  const sumI = peaks.reduce((s, p) => s + p.I, 0) || 1;
  const scale = (range(r, 5e3, 3e4) * 6) / sumI * 6;
  const prof = (d: number) => {
    let v = 0;
    for (const p of peaks) {
      const t = (d - p.d) / p.w;
      if (Math.abs(t) < 12) v += scale * p.I * (0.7 * Math.exp(-0.5 * t * t) + 0.3 / (1 + t * t)) / 2;
    }
    return v;
  };
  const bgf = (d: number) => range(() => 0.5, 0, 1) * 0 + 80 + 260 * Math.exp(-(d - dmin) / 0.55) + 40 * d;
  const N = 520;
  const xs: number[] = [];
  const yo: number[] = [];
  const yc: number[] = [];
  let top = 0;
  for (let i = 0; i < N; i++) {
    const d = dmin + (i / (N - 1)) * (dmax - dmin);
    const model = prof(d) + bgf(d);
    const obs = poisson(r, model);
    const calc = model * (1 + gauss(r) * 0.004);
    xs.push(d); yo.push(obs); yc.push(calc);
    if (obs > top) top = obs;
  }
  const ymin = -top * 0.28;
  const ymax = top * 1.08;
  const f = frame(ctx, "#f8fafc", "d-spacing (Å)", "Intensity (counts)", [+dmin.toFixed(2), +dmax.toFixed(2)], [ymin, ymax]);
  const X = (d: number) => f.l + ((d - dmin) / (dmax - dmin)) * f.w;
  const Y = (v: number) => f.t + f.h - ((v - ymin) / (ymax - ymin)) * f.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.l, f.t, f.w, f.h);
  ctx.clip();
  ctx.fillStyle = "#1d4ed8";
  for (let i = 0; i < N; i++) { ctx.beginPath(); ctx.arc(X(xs[i]!), Y(yo[i]!), 1.7, 0, 6.3); ctx.fill(); }
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  yc.forEach((v, i) => (i ? ctx.lineTo(X(xs[i]!), Y(v)) : ctx.moveTo(X(xs[i]!), Y(v))));
  ctx.stroke();
  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 1;
  ctx.beginPath();
  yo.forEach((v, i) => { const y = Y(-top * 0.14 + (v - yc[i]!) * 0.9); i ? ctx.lineTo(X(xs[i]!), y) : ctx.moveTo(X(xs[i]!), y); });
  ctx.stroke();
  ctx.strokeStyle = "#16a34a";
  for (const p of peaks) { ctx.beginPath(); ctx.moveTo(X(p.d), Y(-top * 0.235)); ctx.lineTo(X(p.d), Y(-top * 0.205)); ctx.stroke(); }
  ctx.restore();
  return finish(c);
}

// ================= Reflectometry: R(Q) from a Parratt calculation on a film stack, with error bars and the fit
type C = [number, number];
const cmul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a: C, b: C): C => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const cadd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const csub = (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]];
const csqrt = (a: C): C => { const m = Math.hypot(a[0], a[1]); const re = Math.sqrt((m + a[0]) / 2); const im = Math.sign(a[1] || 1) * Math.sqrt(Math.max(0, (m - a[0]) / 2)); return [re, im]; };
const cexp = (a: C): C => { const e = Math.exp(a[0]); return [e * Math.cos(a[1]), e * Math.sin(a[1])]; };

function parratt(q: number, sld: number[], thick: number[], rough: number[]) {
  const n = sld.length;
  const kz: C[] = sld.map((rho) => csqrt([(q / 2) ** 2 - 4 * Math.PI * (rho - sld[0]!), 0]));
  let Rj: C = [0, 0];
  for (let j = n - 2; j >= 0; j--) {
    const kj = kz[j]!;
    const k1 = kz[j + 1]!;
    const sig = Math.exp(-2 * kj[0] * k1[0] * rough[j]! ** 2);
    const rj = cdiv(csub(kj, k1), cadd(kj, k1));
    const rr: C = [rj[0] * sig, rj[1] * sig];
    const ph = cexp([0, 0]);
    const e = cmul(cexp([-2 * k1[1] * thick[j + 1]!, 2 * k1[0] * thick[j + 1]!]), ph);
    const num = cadd(rr, cmul(Rj, e));
    const den = cadd([1, 0], cmul(rr, cmul(Rj, e)));
    Rj = cdiv(num, den);
  }
  return Rj[0] * Rj[0] + Rj[1] * Rj[1];
}

function reflect(seed: number) {
  const r = rng(seed);
  const { c, ctx } = makeCanvas();
  const layers = 1 + Math.floor(r() * 3);
  const sld = [0, ...Array.from({ length: layers }, () => range(r, 0.3, 5.5) * 1e-6), 2.07e-6];
  const thick = [0, ...Array.from({ length: layers }, () => range(r, 40, 650)), 0];
  const rough = Array.from({ length: layers + 1 }, () => range(r, 2.5, 9));
  const qmax = range(r, 0.14, 0.3);
  const logLo = -7;
  const f = frame(ctx, "#f8fafc", "Q (Å⁻¹)", "Reflectivity", [0, +qmax.toFixed(2)], [logLo, 0.3], { logY: true });
  const X = (q: number) => f.l + (q / qmax) * f.w;
  const Y = (v: number) => f.t + f.h - ((Math.log10(Math.max(v, 1e-9)) - logLo) / (0.3 - logLo)) * f.h;
  const pts = 90;
  const fit: number[] = [];
  const clip = () => { ctx.save(); ctx.beginPath(); ctx.rect(f.l, f.t, f.w, f.h); ctx.clip(); };
  clip();
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i <= 300; i++) {
    const q = 0.006 + (i / 300) * (qmax - 0.006);
    const R = parratt(q, sld, thick, rough) + 3e-8;
    i ? ctx.lineTo(X(q), Y(R)) : ctx.moveTo(X(q), Y(R));
  }
  ctx.stroke();
  ctx.fillStyle = "#1d4ed8";
  ctx.strokeStyle = "#1d4ed8";
  ctx.lineWidth = 1;
  for (let i = 0; i < pts; i++) {
    const q = 0.008 + (i / (pts - 1)) * (qmax - 0.008);
    const R = parratt(q, sld, thick, rough) + 3e-8;
    const rel = 0.03 + 0.5 * Math.sqrt(1 / (R * 1e6 + 1)) * q * 4;
    const obs = Math.max(2e-8, R * (1 + gauss(r) * rel));
    fit.push(obs);
    const x = X(q);
    ctx.beginPath(); ctx.moveTo(x, Y(obs * (1 + rel))); ctx.lineTo(x, Y(Math.max(1e-9, obs * (1 - rel)))); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, Y(obs), 2, 0, 6.3); ctx.fill();
  }
  ctx.restore();
  return finish(c);
}

// ================= Vibrational spectroscopy: S(E) with librations, bends and stretches
function ins(seed: number) {
  const r = rng(seed);
  const { c, ctx } = makeCanvas();
  const eMax = pick(r, [2000, 3500, 4000]);
  const modes = [
    ...Array.from({ length: 2 + Math.floor(r() * 4) }, () => ({ e: range(r, 80, 650), I: range(r, 0.4, 1), w: range(r, 14, 40) })),
    ...Array.from({ length: 3 + Math.floor(r() * 4) }, () => ({ e: range(r, 700, 1700), I: range(r, 0.15, 0.7), w: range(r, 14, 36) })),
    ...Array.from({ length: r() < 0.7 ? 1 + Math.floor(r() * 3) : 0 }, () => ({ e: range(r, 2800, 3150), I: range(r, 0.05, 0.25), w: range(r, 30, 70) })),
  ].filter((m) => m.e < eMax);
  const N = 500;
  const ys: number[] = [];
  for (let i = 0; i < N; i++) {
    const e = (i / (N - 1)) * eMax;
    let v = 0.04 + 0.55 * Math.exp(-e / 160) + 0.0002 * e * Math.exp(-e / 1500);
    for (const m of modes) v += m.I * Math.exp(-0.5 * ((e - m.e) / m.w) ** 2);
    ys.push(v * (1 + gauss(r) * 0.012) + gauss(r) * 0.006);
  }
  const top = Math.max(...ys) * 1.08;
  const f = frame(ctx, "#f8fafc", "Energy transfer (cm⁻¹)", "S(Q,ω)", [0, eMax], [0, +top.toFixed(2)], { noYTicks: false });
  const X = (e: number) => f.l + (e / eMax) * f.w;
  const Y = (v: number) => f.t + f.h - (v / top) * f.h;
  ctx.save();
  ctx.beginPath(); ctx.rect(f.l, f.t, f.w, f.h); ctx.clip();
  ctx.fillStyle = "rgba(29,78,216,0.12)";
  ctx.beginPath(); ctx.moveTo(X(0), Y(0));
  ys.forEach((v, i) => ctx.lineTo(X((i / (N - 1)) * eMax), Y(v)));
  ctx.lineTo(X(eMax), Y(0)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#1e3a8a"; ctx.lineWidth = 1.3;
  ctx.beginPath();
  ys.forEach((v, i) => (i ? ctx.lineTo(X((i / (N - 1)) * eMax), Y(v)) : ctx.moveTo(X(0), Y(v))));
  ctx.stroke();
  ctx.restore();
  return finish(c);
}

const RENDER: Partial<Record<ThumbStyle, (seed: number) => string>> = { sans, single, laue, radiograph, sqw, qens, powder, reflect, ins };
export const isDetectorStyle = (s: ThumbStyle) => s in RENDER;

const cache = new Map<string, string>();
export function detectorImageUrl(seed: number, style: ThumbStyle) {
  const key = `${seed}|${style}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const url = RENDER[style]!(seed);
  cache.set(key, url);
  return url;
}
