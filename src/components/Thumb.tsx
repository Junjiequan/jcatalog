import { useId } from "react";
import clsx from "clsx";
import { Cpu, ImageOff } from "lucide-react";
import { api } from "@/api";
import { useResource } from "@/api/hooks";
import { Explain } from "@/components/ui/Overlay";
import type { Dataset, Instrument } from "@/types";

export function Thumb({ d, className, preview }: { d: Pick<Dataset, "thumbnailAttachmentId"> & Partial<Pick<Dataset, "datasetName" | "instrumentName" | "techniques">>; className?: string; preview?: boolean }) {
  // the picture is always an attachment of the dataset; without one there is a neutral placeholder
  const id = d.thumbnailAttachmentId;
  const pic = useResource(["attachment-picture", id], () => api.attachments.picture(id!), { enabled: !!id });
  const src = pic.data;
  const img = src ? (
    <img src={src} alt="" loading="lazy" draggable={false} className={clsx("bg-slate-900 object-cover", className)} />
  ) : (
    <span className={clsx("flex items-center justify-center bg-surface-3 text-subtle", className)} aria-hidden>{id ? null : <ImageOff className="h-1/3 w-1/3 max-h-8 max-w-8" />}</span>
  );
  if (!preview || !src) return img;
  // hovering shows the picture large, with what it is
  return (
    <Explain
      large
      delay={250}
      title={d.datasetName ?? "Preview"}
      text={[d.instrumentName, ...(d.techniques ?? []).map((t) => t.name)].filter(Boolean).join(" · ") || "Detector image"}
      image={<img src={src} alt="" draggable={false} className="block aspect-[8/5] w-full bg-slate-900 object-cover" />}
    >
      {img}
    </Explain>
  );
}

// The mark: an atom drawn as three tilted orbits around a nucleus, on a cyan-to-blue tile
export function Logo({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#35c3f5" />
          <stop offset="0.55" stopColor="#009de0" />
          <stop offset="1" stopColor="#0a5fa8" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.3" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id}-bg)`} />
      <rect width="32" height="32" rx="9" fill={`url(#${id}-glow)`} />
      <g fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round">
        <ellipse cx="16" cy="16" rx="11" ry="4.4" opacity="0.95" />
        <ellipse cx="16" cy="16" rx="11" ry="4.4" transform="rotate(60 16 16)" opacity="0.8" />
        <ellipse cx="16" cy="16" rx="11" ry="4.4" transform="rotate(120 16 16)" opacity="0.65" />
      </g>
      <circle cx="16" cy="16" r="2.7" fill="#fff" />
      <circle cx="26.6" cy="14.2" r="1.5" fill="#fff" />
    </svg>
  );
}

// The full picture, uncropped: a drawing keeps its own proportions; a placeholder fills a 16:10 frame.
export function InstrumentFull({ i }: { i: Pick<Instrument, "name" | "image"> }) {
  if (i.image) return <img src={i.image} alt={`${i.name} drawing`} draggable={false} className="block h-auto w-full bg-white" />;
  return <InstrumentPlaceholder className="aspect-[16/10] w-full" />;
}

// an instrument without a drawing
function InstrumentPlaceholder({ className }: { className?: string }) {
  return <span aria-hidden className={clsx("flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-700 text-white/50", className)}><Cpu className="h-1/2 max-h-10 w-1/2" strokeWidth={1.5} /></span>;
}

// An instrument's picture: its own drawing or photo, or a placeholder when the facility has none. Hovering shows the large picture with the instrument's name and credit;
// `preview={false}` where the surrounding control already shows one.
export function InstrumentThumb({ i, className, preview = true, wide, whole }: { i: Pick<Instrument, "name" | "image"> & Partial<Pick<Instrument, "title" | "techniques">>; className?: string; preview?: boolean; wide?: boolean; whole?: boolean }) {
  const real = !!i.image;

  // `whole`: a frame at the drawings' own 2.63:1 ratio, so the full picture shows and nothing is cropped
  const img = real
    ? <img src={i.image} alt={`${i.name} drawing`} loading="lazy" draggable={false} className={clsx("bg-white", whole ? "aspect-[1920/731] w-full object-contain" : "object-cover", className)} />
    : <InstrumentPlaceholder className={clsx(whole && "aspect-[1920/731] w-full", className)} />;
  if (!preview) return img;
  const credit = real ? "Image: ESS" : "No drawing yet";
  return (
    <Explain
      image={<InstrumentFull i={i} />}
      wide={wide}
      title={i.title ? `${i.name} — ${i.title}` : i.name}
      text={[...(i.techniques ?? []), credit].join(" · ")}
    >
      {img}
    </Explain>
  );
}
