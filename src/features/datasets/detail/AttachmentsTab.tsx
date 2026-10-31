import clsx from "clsx";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, File as FileIcon, FileCode, FileText, ImageIcon, Music, Paperclip, Pencil, Star, Trash2, Upload, Video, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal, Tip } from "@/components/ui/Overlay";
import { ErrorState, Skeleton } from "@/components/ui/Primitives";
import { api } from "@/api";
import { useResource } from "@/api/hooks";
import { confirm } from "@/store/confirm";
import { toast } from "@/store/toasts";
import { dataUrlToBlob, dataUrlToText, extOf, kindOf, langOf, makeThumbnail, readDataUrl, saveDataUrl, type FileKind, bytesOf } from "@/lib/attachments";
import { fmtBytes, fmtDate } from "@/lib/format";
import type { Attachment, Dataset } from "@/types";

// files are kept in memory in this catalogue, so a single file is capped
const MAX_BYTES = 25 * 1024 * 1024;

const KIND_ICON: Record<FileKind, typeof FileIcon> = { image: ImageIcon, pdf: FileText, text: FileText, code: FileCode, video: Video, audio: Music, other: FileIcon };
const KIND_LABEL: Record<FileKind, string> = { image: "Image", pdf: "PDF", text: "Text", code: "Script", video: "Video", audio: "Audio", other: "File" };

// pictures for attachments that arrive without one (seeded records), drawn once
const drawn = new Map<string, string>();
// The picture of an attachment: its stored thumbnail, one drawn earlier, or one drawn now (and remembered)
function usePicture(a: Attachment) {
  const [fresh, setFresh] = useState<{ id: string; src: string }>();
  useEffect(() => {
    if (a.thumbnail || drawn.has(a.id)) return;
    let live = true;
    makeThumbnail(a).then((src) => {
      drawn.set(a.id, src);
      if (live) setFresh({ id: a.id, src });
    });
    return () => {
      live = false;
    };
  }, [a]);
  return a.thumbnail ?? drawn.get(a.id) ?? (fresh?.id === a.id ? fresh.src : undefined);
}

export function AttachmentsTab({ d, canEdit, onDataset }: { d: Dataset; canEdit: boolean; onDataset: (next: Dataset) => void }) {
  const { data, error, reload, mutate } = useResource(["attachments", d.pid], () => api.attachments.list(d.pid));
  const [busy, setBusy] = useState(0);
  const [over, setOver] = useState(false);
  const [open, setOpen] = useState<Attachment | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (list: FileList | File[]) => {
    const files = [...list];
    if (!files.length) return;
    const ok = files.filter((f) => f.size <= MAX_BYTES);
    if (ok.length < files.length) toast.error("Some files are too large", { description: `Files up to ${fmtBytes(MAX_BYTES)} can be attached here.` });
    if (!ok.length) return;
    setBusy((n) => n + ok.length);
    const made: Attachment[] = [];
    for (const f of ok) {
      try {
        const dataUrl = await readDataUrl(f);
        const meta = { fileName: f.name, mimeType: f.type, size: f.size, dataUrl };
        made.push(...(await api.attachments.add(d.pid, [{ ...meta, thumbnail: await makeThumbnail(meta) }])));
      } catch (e) {
        // the backend says why: the same file is already attached, no permission…
        toast.error(`Couldn't attach ${f.name}`, { description: e instanceof Error ? e.message : "Try again." });
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (made.length) {
      mutate((cur) => [...made, ...cur]);
      toast.success(made.length === 1 ? `Attached ${made[0].fileName}` : `Attached ${made.length} files`);
    }
  };

  const remove = async (a: Attachment) => {
    if (!(await confirm({ title: "Remove this attachment?", description: `“${a.fileName}” will be removed from the dataset.`, confirmLabel: "Remove", tone: "danger" }))) return;
    await api.attachments.remove(a.id);
    mutate((cur) => cur.filter((x) => x.id !== a.id));
    if (d.thumbnailAttachmentId === a.id) onDataset({ ...d, thumbnailAttachmentId: undefined });
    toast.success("Attachment removed");
  };

  const makeThumb = async (a: Attachment) => {
    const next = await api.attachments.setThumbnail(d.pid, a.id);
    onDataset({ ...next });
    toast.success("Now the dataset's thumbnail", { description: a.fileName });
  };
  const resetThumb = async () => {
    const next = await api.attachments.setThumbnail(d.pid, null);
    onDataset({ ...next });
    toast.success("Thumbnail removed");
  };

  if (error) return <ErrorState message="The attachments aren't available right now." onRetry={reload} />;
  const list = data ?? [];

  return (
    <div
      onDragOver={(e) => canEdit && (e.preventDefault(), setOver(true))}
      onDragLeave={(e) => e.currentTarget === e.target && setOver(false)}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setOver(false);
        void upload(e.dataTransfer.files);
      }}
      className={clsx("space-y-4 rounded-2xl transition-colors", over && "bg-accent-soft/60 ring-2 ring-accent ring-offset-4 ring-offset-canvas")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Attachments {data && <span className="tnum font-normal text-muted">· {list.length}</span>}</h2>
          <p className="mt-0.5 text-[13px] text-muted">Pictures, PDFs, scripts or any other file that explains this dataset. Pick one as its thumbnail.</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <input ref={input} type="file" multiple hidden onChange={(e) => (void upload(e.target.files ?? []), (e.target.value = ""))} />
              <Button variant="primary" onClick={() => input.current?.click()}><Upload className="h-4 w-4" />Upload files</Button>
            </>
          )}
        </div>
      </div>

      {!data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 w-full rounded-xl" />)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => (
            <AttachmentCard key={a.id} a={a} isThumb={d.thumbnailAttachmentId === a.id} canEdit={canEdit} onOpen={() => setOpen(a)} onRemove={() => remove(a)} onThumb={() => (d.thumbnailAttachmentId === a.id ? resetThumb() : makeThumb(a))} onCaption={async (caption) => { const next = await api.attachments.update(a.id, { caption }); mutate((cur) => cur.map((x) => (x.id === a.id ? next : x))); }} />
          ))}
          {canEdit && (
            <button
              onClick={() => input.current?.click()}
              className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-surface-2/50 px-6 py-8 text-center text-muted transition-colors hover:border-accent hover:bg-accent-soft/50 hover:text-accent"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm"><Upload className="h-5 w-5" /></span>
              <span className="text-sm font-medium text-fg">{busy ? `Uploading ${busy} file${busy > 1 ? "s" : ""}…` : "Drop files here or click to browse"}</span>
              <span className="text-xs">Any format, up to {fmtBytes(MAX_BYTES)} each</span>
            </button>
          )}
          {!list.length && !canEdit && <p className="col-span-full py-10 text-center text-sm text-muted">Nothing has been attached to this dataset.</p>}
        </div>
      )}

      <Modal open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={open?.fileName ?? ""} description={open ? `${KIND_LABEL[kindOf(open.fileName, open.mimeType)]} · ${fmtBytes(open.size)}${open.caption ? ` · ${open.caption}` : ""}` : ""} size="xl" footer={open && <><Button onClick={() => saveDataUrl(open.fileName, open.dataUrl, open.mimeType)}><Download className="h-4 w-4" />Download</Button></>}>
        {open && <Preview a={open} />}
      </Modal>
    </div>
  );
}

function AttachmentCard({ a, isThumb, canEdit, onOpen, onRemove, onThumb, onCaption }: { a: Attachment; isThumb: boolean; canEdit: boolean; onOpen: () => void; onRemove: () => void; onThumb: () => void; onCaption: (c: string) => Promise<void> }) {
  const kind = kindOf(a.fileName, a.mimeType);
  const Icon = KIND_ICON[kind];
  const picture = usePicture(a);
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(a.caption);
  const save = async () => {
    setEdit(false);
    if (text.trim() !== a.caption) await onCaption(text.trim());
  };
  return (
    <article className="group card flex flex-col overflow-hidden">
      <button onClick={onOpen} className="relative block aspect-[8/5] w-full overflow-hidden bg-slate-900" aria-label={`Preview ${a.fileName}`}>
        {picture ? <img src={picture} alt="" draggable={false} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" /> : <Skeleton className="h-full w-full rounded-none" />}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white"><Icon className="h-3 w-3" />{langOf(a.fileName) ?? (kind === "other" ? extOf(a.fileName).toUpperCase() : KIND_LABEL[kind])}</span>
        {isThumb && <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />Thumbnail</span>}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/35 group-hover:opacity-100"><Eye className="h-6 w-6" /></span>
      </button>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {edit ? (
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onBlur={save} onKeyDown={(e) => (e.key === "Enter" ? save() : e.key === "Escape" ? (setText(a.caption), setEdit(false)) : undefined)} placeholder="Add a caption" aria-label="Caption" className="field h-8 text-sm" />
        ) : (
          <button disabled={!canEdit} onClick={() => setEdit(true)} className={clsx("group/cap flex items-center gap-1.5 text-left text-sm font-medium", canEdit && "hover:text-accent")} title={canEdit ? "Click to edit the caption" : undefined}>
            <span className={clsx("min-w-0 truncate", !a.caption && "font-normal text-subtle")}>{a.caption || (canEdit ? "Add a caption" : a.fileName)}</span>
            {canEdit && <Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover/cap:opacity-60" />}
          </button>
        )}
        <div className="truncate text-xs text-muted" title={a.fileName}>{a.fileName}</div>
        <div className="tnum text-xs text-subtle">{fmtBytes(a.size)} · {fmtDate(a.createdAt)}</div>
        <div className="mt-auto flex items-center gap-0.5 pt-2">
          <Tip label="Download"><Button size="icon-sm" variant="ghost" aria-label="Download" onClick={() => saveDataUrl(a.fileName, a.dataUrl, a.mimeType)}><Download className="h-4 w-4" /></Button></Tip>
          {canEdit && (
            <Tip label={isThumb ? "The dataset's thumbnail · click to remove" : "Use as the dataset's thumbnail"}>
              <Button size="icon-sm" variant="ghost" aria-label={isThumb ? "Remove as thumbnail" : "Use as thumbnail"} aria-pressed={isThumb} onClick={onThumb}>
                <Star className={clsx("h-4 w-4", isThumb && "fill-amber-400 text-amber-400")} />
              </Button>
            </Tip>
          )}
          {canEdit && <span className="ml-auto"><Tip label="Remove"><Button size="icon-sm" variant="ghost" aria-label="Remove" className="hover:text-danger" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button></Tip></span>}
        </div>
      </div>
    </article>
  );
}

// What each kind of file shows: the thing itself where a browser can, its text where it is text, and a plain card for the rest
// pdf.js is big and only a PDF preview needs it
const PdfView = lazy(() => import("@/components/PdfView"));

function Preview({ a }: { a: Attachment }) {
  const kind = kindOf(a.fileName, a.mimeType);
  const [blobUrl, setBlobUrl] = useState<string>();
  const bytes = useMemo(() => (kind === "pdf" ? bytesOf(a.dataUrl) : undefined), [a.dataUrl, kind]);
  useEffect(() => {
    if (kind !== "video" && kind !== "audio") return;
    const url = URL.createObjectURL(dataUrlToBlob(a.dataUrl, a.mimeType));
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [a.dataUrl, a.mimeType, kind]);

  if (kind === "image") return <ImageViewer src={a.dataUrl} alt={a.fileName} />;
  if (kind === "pdf") return <Suspense fallback={<Skeleton className="h-[60vh] w-full rounded-none" />}><PdfView bytes={bytes!} /></Suspense>;
  // uploaded files come without caption tracks
  /* oxlint-disable jsx-a11y/media-has-caption */
  if (kind === "video") return <div className="bg-black">{blobUrl && <video src={blobUrl} controls className="mx-auto max-h-[68vh] w-full" />}</div>;
  if (kind === "audio") return <div className="flex items-center justify-center p-10">{blobUrl && <audio src={blobUrl} controls className="w-full max-w-md" />}</div>;
  /* oxlint-enable jsx-a11y/media-has-caption */
  if (kind === "text" || kind === "code") return <TextPreview a={a} />;
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Paperclip className="h-7 w-7" /></span>
      <div className="text-sm font-semibold">{a.fileName}</div>
      <p className="max-w-sm text-[13px] text-muted">There is no inline preview for {extOf(a.fileName) ? `.${extOf(a.fileName)}` : "this"} files ({a.mimeType || "unknown type"}, {fmtBytes(a.size)}). Download it to open it in the right application.</p>
      <Button onClick={() => saveDataUrl(a.fileName, a.dataUrl, a.mimeType)}><Download className="h-4 w-4" />Download</Button>
    </div>
  );
}

// An image that can be looked at closely: scroll or pinch to zoom, drag to pan, double-click to zoom in or back out
const MAX_ZOOM = 16;
function ImageViewer({ src, alt }: { src: string; alt: string }) {
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [v, setV] = useState({ s: 1, x: 0, y: 0 });
  const [fit, setFit] = useState(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);

  const clampTo = (s: number, x: number, y: number) => {
    const b = box.current!.getBoundingClientRect();
    const mx = (b.width * s) / 2;
    const my = (b.height * s) / 2;
    return { s, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  };
  // zoom by `factor` around a point on screen, so what is under the pointer stays under it
  const zoomAt = (factor: number, cx?: number, cy?: number) =>
    setV((cur) => {
      const b = box.current!.getBoundingClientRect();
      const s = Math.min(MAX_ZOOM, Math.max(1, cur.s * factor));
      if (s === 1) return { s: 1, x: 0, y: 0 };
      const px = (cx ?? b.left + b.width / 2) - b.left - b.width / 2;
      const py = (cy ?? b.top + b.height / 2) - b.top - b.height / 2;
      const k = s / cur.s;
      return clampTo(s, px - (px - cur.x) * k, py - (py - cur.y) * k);
    });
  const actualSize = () => {
    const el = img.current;
    if (!el) return;
    const ratio = el.naturalWidth / el.clientWidth;
    setV(ratio > 1 ? clampTo(Math.min(MAX_ZOOM, ratio), 0, 0) : { s: 1, x: 0, y: 0 });
  };

  // a wheel listener that can stop the page scrolling underneath
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const on = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", on, { passive: false });
    return () => el.removeEventListener("wheel", on);
  }, []);

  const pct = Math.round(v.s * fit * 100);
  // the picture is a widget with its own keys (+, -, arrows, 0), so it takes focus and key events
  /* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  return (
    <div
      ref={box}
      role="application"
      tabIndex={0}
      aria-label={`${alt}, zoomable image`}
      onKeyDown={(e) => {
        if (e.key === "+" || e.key === "=") zoomAt(1.4);
        else if (e.key === "-") zoomAt(1 / 1.4);
        else if (e.key === "0") setV({ s: 1, x: 0, y: 0 });
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
          const [p, q] = [...pointers.current.values()];
          pinch.current = Math.hypot(p.x - q.x, p.y - q.y);
        }
      }}
      onPointerMove={(e) => {
        const prev = pointers.current.get(e.pointerId);
        if (!prev) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
          const [p, q] = [...pointers.current.values()];
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (pinch.current) zoomAt(d / pinch.current, (p.x + q.x) / 2, (p.y + q.y) / 2);
          pinch.current = d;
        } else if (v.s > 1) {
          setV((cur) => clampTo(cur.s, cur.x + e.clientX - prev.x, cur.y + e.clientY - prev.y));
        }
      }}
      onPointerUp={(e) => (pointers.current.delete(e.pointerId), (pinch.current = 0))}
      onPointerCancel={(e) => (pointers.current.delete(e.pointerId), (pinch.current = 0))}
      onDoubleClick={(e) => (v.s > 1 ? setV({ s: 1, x: 0, y: 0 }) : zoomAt(3, e.clientX, e.clientY))}
      className={clsx("relative flex h-[68vh] touch-none select-none items-center justify-center overflow-hidden bg-surface-2 outline-hidden", v.s > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
    >
      <img
        ref={img}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(e) => setFit(e.currentTarget.clientWidth / e.currentTarget.naturalWidth)}
        style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.s})` }}
        className="max-h-full max-w-full object-contain will-change-transform"
      />
      <div className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-lg bg-black/65 p-1 text-white" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <Tip label="Zoom out"><button aria-label="Zoom out" onClick={() => zoomAt(1 / 1.5)} disabled={v.s <= 1} className="rounded-md p-1.5 hover:bg-white/15 disabled:opacity-40"><ZoomOut className="h-4 w-4" /></button></Tip>
        <span className="tnum w-12 text-center text-xs font-medium">{pct}%</span>
        <Tip label="Zoom in"><button aria-label="Zoom in" onClick={() => zoomAt(1.5)} disabled={v.s >= MAX_ZOOM} className="rounded-md p-1.5 hover:bg-white/15 disabled:opacity-40"><ZoomIn className="h-4 w-4" /></button></Tip>
        <span className="mx-0.5 h-5 w-px bg-white/25" />
        <Tip label="Actual pixels"><button aria-label="Actual size" onClick={actualSize} className="rounded-md px-2 py-1 text-xs font-semibold hover:bg-white/15">1:1</button></Tip>
        <Tip label="Fit to window"><button aria-label="Fit to window" onClick={() => setV({ s: 1, x: 0, y: 0 })} disabled={v.s === 1} className="rounded-md p-1.5 hover:bg-white/15 disabled:opacity-40"><Maximize2 className="h-4 w-4" /></button></Tip>
      </div>
      {v.s === 1 && <span className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/50 px-2 py-1 text-[11px] text-white/90">Scroll to zoom · drag to pan · double-click to zoom in</span>}
    </div>
  );
  /* oxlint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
}

const MAX_LINES = 2500;
function TextPreview({ a }: { a: Attachment }) {
  const text = useMemo(() => {
    try {
      const raw = dataUrlToText(a.dataUrl);
      return extOf(a.fileName) === "json" ? (() => { try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; } })() : raw;
    } catch {
      return "";
    }
  }, [a.dataUrl, a.fileName]);
  const lines = text.split("\n");
  const shown = lines.slice(0, MAX_LINES);
  return (
    <div className="bg-slate-950 text-slate-200">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-slate-400">
        <span>{langOf(a.fileName) ?? "Plain text"}</span>
        <span className="tnum">{lines.length.toLocaleString()} lines</span>
      </div>
      <pre className="max-h-[64vh] overflow-auto py-3 font-mono text-[12.5px] leading-5">
        {shown.map((l, i) => (
          <div key={i} className="flex">
            <span className="tnum w-12 shrink-0 select-none pr-3 text-right text-slate-600">{i + 1}</span>
            <code className="whitespace-pre pr-4">{l || " "}</code>
          </div>
        ))}
        {lines.length > shown.length && <div className="px-4 pt-2 text-xs text-slate-500">…{(lines.length - shown.length).toLocaleString()} more lines. Download the file to read the rest.</div>}
      </pre>
    </div>
  );
}

