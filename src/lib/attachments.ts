// Helpers for dataset attachments: what kind of file it is, how to read it, and a picture to stand for it.
// Any file can be attached; the picture is the file itself for an image, and a drawn card (first lines, a page, an extension) for the rest.

export type FileKind = "image" | "pdf" | "text" | "code" | "video" | "audio" | "other";

const CODE: Record<string, string> = {
  py: "Python", js: "JavaScript", mjs: "JavaScript", cjs: "JavaScript", ts: "TypeScript", jsx: "JavaScript (JSX)", tsx: "TypeScript (TSX)",
  sh: "Shell", bash: "Shell", zsh: "Shell", ps1: "PowerShell", bat: "Batch", r: "R", jl: "Julia", m: "MATLAB", c: "C", h: "C header", cpp: "C++", cc: "C++", hpp: "C++ header",
  java: "Java", kt: "Kotlin", go: "Go", rs: "Rust", rb: "Ruby", php: "PHP", pl: "Perl", lua: "Lua", swift: "Swift", cs: "C#", f90: "Fortran", f: "Fortran",
  sql: "SQL", html: "HTML", htm: "HTML", css: "CSS", scss: "SCSS", xml: "XML", json: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML", ini: "INI", cfg: "Config",
  ipynb: "Jupyter notebook", tex: "LaTeX", mk: "Makefile", cmake: "CMake", dockerfile: "Dockerfile",
};
const TEXT = new Set(["txt", "md", "markdown", "rst", "csv", "tsv", "log", "dat", "asc", "out", "hkl", "xye", "cif", "pdb", "nxs.txt"]);

export const extOf = (name: string) => {
  const base = name.split("/").pop() ?? name;
  const i = base.lastIndexOf(".");
  return i > 0 ? base.slice(i + 1).toLowerCase() : base.toLowerCase();
};
export const langOf = (name: string) => CODE[extOf(name)];

export function kindOf(name: string, mime = ""): FileKind {
  const ext = extOf(name);
  if (mime.startsWith("image/") && !mime.includes("tiff")) return "image";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"].includes(ext)) return "image";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(ext)) return "video";
  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) return "audio";
  if (CODE[ext]) return "code";
  if (mime.startsWith("text/") || mime === "application/json" || TEXT.has(ext)) return "text";
  return "other";
}

export function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export const textToDataUrl = (text: string, mime = "text/plain") => `data:${mime};charset=utf-8;base64,${btoa(unescape(encodeURIComponent(text)))}`;

// the bytes of a data: URL
function bytesOf(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const head = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  if (head.includes(";base64")) return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return new TextEncoder().encode(decodeURIComponent(body));
}
export const dataUrlToText = (dataUrl: string) => new TextDecoder().decode(bytesOf(dataUrl));
export const dataUrlToBlob = (dataUrl: string, mime: string) => new Blob([bytesOf(dataUrl) as BlobPart], { type: mime || "application/octet-stream" });

export function saveDataUrl(fileName: string, dataUrl: string, mime: string) {
  const url = URL.createObjectURL(dataUrlToBlob(dataUrl, mime));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- the picture that stands for a file
const TW = 480;
const TH = 300;
const FONT_MONO = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
const FONT_SANS = "600 13px Inter, system-ui, sans-serif";

function hueOf(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("not an image"));
    img.src = src;
  });
}

export async function makeThumbnail(f: { fileName: string; mimeType: string; dataUrl: string }): Promise<string> {
  const kind = kindOf(f.fileName, f.mimeType);
  const c = document.createElement("canvas");
  c.width = TW;
  c.height = TH;
  const ctx = c.getContext("2d")!;
  const ext = extOf(f.fileName).toUpperCase().slice(0, 6);

  if (kind === "image") {
    try {
      const img = await loadImage(f.dataUrl);
      // cover the frame
      const k = Math.max(TW / img.width, TH / img.height);
      const w = img.width * k;
      const h = img.height * k;
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, TW, TH);
      ctx.drawImage(img, (TW - w) / 2, (TH - h) / 2, w, h);
      return c.toDataURL("image/jpeg", 0.85);
    } catch {
      /* fall through to a card */
    }
  }

  if (kind === "text" || kind === "code") {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, TW, TH);
    let text = "";
    try {
      text = dataUrlToText(f.dataUrl).slice(0, 4000);
    } catch {
      /* unreadable: leave blank */
    }
    ctx.font = FONT_MONO;
    ctx.textBaseline = "top";
    text.split("\n").slice(0, 14).forEach((line, i) => {
      ctx.fillStyle = "#475569";
      ctx.fillText(String(i + 1).padStart(2, " "), 14, 40 + i * 17);
      ctx.fillStyle = /^\s*(#|\/\/|--|%)/.test(line) ? "#64748b" : "#cbd5e1";
      ctx.fillText(line.replace(/\t/g, "  ").slice(0, 52), 42, 40 + i * 17);
    });
    ctx.fillStyle = `hsl(${hueOf(ext)} 80% 60%)`;
    ctx.fillRect(0, 0, TW, 26);
    ctx.fillStyle = "#0f172a";
    ctx.font = FONT_SANS;
    ctx.fillText(langOf(f.fileName) ?? (ext || "TEXT"), 14, 6);
    return c.toDataURL("image/jpeg", 0.85);
  }

  // a document or anything else: a card with its extension
  const h = hueOf(ext || f.mimeType);
  const g = ctx.createLinearGradient(0, 0, TW, TH);
  g.addColorStop(0, `hsl(${h} 55% 28%)`);
  g.addColorStop(1, `hsl(${(h + 40) % 360} 60% 16%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TW, TH);
  // a sheet of paper
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  const px = TW / 2 - 66;
  const py = 38;
  ctx.beginPath();
  ctx.roundRect(px, py, 132, 176, 10);
  ctx.fill();
  ctx.fillStyle = kind === "pdf" ? "#dc2626" : `hsl(${h} 70% 45%)`;
  ctx.fillRect(px, py + 18, 132, 34);
  ctx.fillStyle = "#fff";
  ctx.font = "800 22px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ext || "FILE", TW / 2, py + 36);
  ctx.fillStyle = "#cbd5e1";
  for (let i = 0; i < 5; i++) ctx.fillRect(px + 16, py + 72 + i * 20, i === 4 ? 56 : 100, 7);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "500 13px Inter, system-ui, sans-serif";
  ctx.fillText(f.fileName.length > 34 ? `${f.fileName.slice(0, 31)}…` : f.fileName, TW / 2, TH - 40);
  return c.toDataURL("image/jpeg", 0.85);
}
