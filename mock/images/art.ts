import type { ThumbStyle } from "../types";
import { detectorImageUrl, isDetectorStyle } from "./detector";

function prng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 320;
const H = 200;
const hsl = (h: number, s: number, l: number, a = 1) => `hsl(${Math.round(h) % 360} ${s}% ${l}% / ${a})`;

function rings(r: () => number, hue: number) {
  const cx = W / 2 + (r() - 0.5) * 40;
  const cy = H / 2 + (r() - 0.5) * 24;
  let out = `<defs><radialGradient id="g"><stop offset="0" stop-color="${hsl(hue, 90, 60, 0.55)}"/><stop offset="1" stop-color="${hsl(hue, 80, 40, 0)}"/></radialGradient></defs>`;
  out += `<circle cx="${cx}" cy="${cy}" r="120" fill="url(#g)"/>`;
  const n = 7 + Math.floor(r() * 6);
  let rad = 16 + r() * 10;
  for (let i = 0; i < n; i++) {
    rad += 12 + r() * 20;
    const w = 0.8 + r() * 3.2;
    out += `<circle cx="${cx}" cy="${cy}" r="${rad.toFixed(1)}" fill="none" stroke="${hsl(hue + r() * 30, 90, 62, 0.15 + r() * 0.6)}" stroke-width="${w.toFixed(1)}"/>`;
  }
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2;
    const d = 10 + r() * 150;
    out += `<circle cx="${(cx + Math.cos(a) * d).toFixed(1)}" cy="${(cy + Math.sin(a) * d).toFixed(1)}" r="${(0.4 + r() * 1.1).toFixed(1)}" fill="${hsl(hue, 90, 80, 0.15 + r() * 0.5)}"/>`;
  }
  out += `<rect x="${cx - 2}" y="${cy - 14}" width="4" height="${H}" fill="${hsl(hue, 40, 6)}"/><circle cx="${cx}" cy="${cy}" r="7" fill="${hsl(hue, 40, 6)}"/>`;
  return out;
}

function spots(r: () => number, hue: number) {
  const cx = W / 2;
  const cy = H / 2;
  const ang = r() * Math.PI;
  const la = 20 + r() * 12;
  const lb = 22 + r() * 12;
  const ax = Math.cos(ang) * la;
  const ay = Math.sin(ang) * la;
  const bx = Math.cos(ang + 1.2 + r() * 0.4) * lb;
  const by = Math.sin(ang + 1.2 + r() * 0.4) * lb;
  let out = `<circle cx="${cx}" cy="${cy}" r="98" fill="${hsl(hue, 35, 4)}" stroke="${hsl(hue, 40, 22)}" stroke-width="1"/>`;
  out += `<circle cx="${cx}" cy="${cy}" r="${55 + r() * 20}" fill="none" stroke="${hsl(hue, 70, 70, 0.1)}" stroke-width="5"/>`;
  for (let i = -9; i <= 9; i++) {
    for (let j = -9; j <= 9; j++) {
      const x = cx + i * ax + j * bx;
      const y = cy + i * ay + j * by;
      const d = Math.hypot(x - cx, y - cy);
      if (d < 14 || d > 94 || r() < 0.18) continue;
      const rad = Math.max(0.5, 2.6 - d / 45 + (r() - 0.5));
      out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(2)}" fill="${hsl(hue, 80, 85, 0.35 + r() * 0.65)}"/>`;
    }
  }
  out += `<circle cx="${cx}" cy="${cy}" r="6" fill="${hsl(hue, 30, 2)}"/>`;
  return out;
}

function micrograph(r: () => number, hue: number, seed: number) {
  let out = `<defs><filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed % 97}"/><feColorMatrix type="saturate" values="0"/></filter><radialGradient id="v"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></radialGradient></defs>`;
  out += `<rect width="${W}" height="${H}" fill="${hsl(hue, 8, 38)}"/><rect width="${W}" height="${H}" filter="url(#n)" opacity="0.5"/>`;
  for (let i = 0; i < 38; i++) {
    const x = r() * W;
    const y = r() * H;
    const rx = 5 + r() * 5;
    const ry = rx * (0.7 + r() * 0.3);
    out += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" transform="rotate(${Math.floor(r() * 180)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${hsl(hue, 10, 22, 0.55)}" stroke="${hsl(hue, 10, 70, 0.35)}" stroke-width="1"/>`;
  }
  out += `<rect width="${W}" height="${H}" fill="url(#v)"/>`;
  return out;
}

function spectrum(r: () => number, hue: number) {
  const peaks = Array.from({ length: 4 + Math.floor(r() * 6) }, () => ({
    c: 20 + r() * (W - 40),
    a: 25 + r() * 110,
    w: 1.5 + r() * (r() < 0.5 ? 4 : 14),
  }));
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 2) {
    let y = 14 + r() * 1.2;
    for (const p of peaks) y += p.a * Math.exp(-(((x - p.c) / p.w) ** 2));
    pts.push(`${x},${(H - 24 - y).toFixed(1)}`);
  }
  const d = `M${pts.join(" L")}`;
  let out = `<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hsl(hue, 90, 60, 0.4)}"/><stop offset="1" stop-color="${hsl(hue, 90, 60, 0)}"/></linearGradient></defs>`;
  for (let i = 1; i < 6; i++) out += `<line x1="0" x2="${W}" y1="${(H / 6) * i}" y2="${(H / 6) * i}" stroke="${hsl(hue, 30, 30, 0.35)}" stroke-width="0.6"/>`;
  out += `<path d="${d} L${W},${H} L0,${H} Z" fill="url(#a)"/><path d="${d}" fill="none" stroke="${hsl(hue, 95, 68)}" stroke-width="1.5" stroke-linejoin="round"/>`;
  return out;
}

function bands(r: () => number, hue: number) {
  let out = `<defs><filter id="b"><feGaussianBlur stdDeviation="3"/></filter></defs>`;
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const y0 = 20 + (i / n) * (H - 10) + r() * 10;
    const k = (r() < 0.5 ? -1 : 1) * (0.0009 + r() * 0.0018);
    const xc = W / 2 + (r() - 0.5) * 50;
    const pts: string[] = [];
    for (let x = 0; x <= W; x += 6) pts.push(`${x},${(y0 + k * (x - xc) ** 2 * 60).toFixed(1)}`);
    const dd = `M${pts.join(" L")}`;
    const col = hsl(hue + i * 6, 90, 60 + r() * 15, 0.45 + r() * 0.4);
    out += `<path d="${dd}" fill="none" stroke="${col}" stroke-width="6" filter="url(#b)"/><path d="${dd}" fill="none" stroke="${col}" stroke-width="1.6"/>`;
  }
  const cx = W / 2;
  out += `<path d="M${cx - 80},${H} L${cx},${H / 2} L${cx + 80},${H}" fill="none" stroke="${hsl(hue + 40, 95, 75, 0.9)}" stroke-width="1.8"/><path d="M${cx - 80},0 L${cx},${H / 2} L${cx + 80},0" fill="none" stroke="${hsl(hue + 40, 95, 75, 0.9)}" stroke-width="1.8"/>`;
  return out;
}

const cache = new Map<string, string>();

export function thumbUrl(seed: number, style: ThumbStyle, hue: number): string {
  if (isDetectorStyle(style)) return detectorImageUrl(seed, style);
  const key = `${seed}|${style}|${hue}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = prng(seed);
  const bg = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hsl(hue, 45, 7)}"/><stop offset="1" stop-color="${hsl(hue + 20, 50, 13)}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/>`;
  let body = "";
  if (style === "rings") body = rings(r, hue);
  else if (style === "spots") body = spots(r, hue);
  else if (style === "micrograph") body = micrograph(r, hue, seed);
  else if (style === "spectrum") body = spectrum(r, hue);
  else body = bands(r, hue);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${bg}${body}</svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  cache.set(key, url);
  return url;
}
