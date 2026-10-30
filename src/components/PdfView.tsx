import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Minus, Plus } from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Primitives";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// A PDF drawn page by page with pdf.js, so it looks the same in every browser: the embedded viewer is missing in some
// and shows an empty dark frame. Pages are drawn at the width of the box, times the zoom, as they come into view.
export default function PdfView({ bytes }: { bytes: Uint8Array }) {
  const box = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy>();
  const [error, setError] = useState<string>();
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let live = true;
    setDoc(undefined);
    setError(undefined);
    // pdf.js hands the buffer to its worker, so it gets a copy
    const task = pdfjs.getDocument({ data: bytes.slice() });
    task.promise.then(
      (d) => live && setDoc(d),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
      void task.destroy();
    };
  }, [bytes]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  if (error) return <p className="px-6 py-14 text-center text-sm text-muted">This PDF can't be shown here ({error}). Download it to open it in a reader.</p>;
  const pageWidth = Math.max(120, Math.floor((width - 32) * zoom));
  return (
    <div ref={box} className="bg-surface-2">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/90 px-3 py-1.5 text-xs text-muted backdrop-blur-sm">
        <span>{doc ? `${doc.numPages} ${doc.numPages === 1 ? "page" : "pages"}` : "Loading…"}</span>
        <span className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}><Minus className="h-4 w-4" /></Button>
          <span className="tnum w-11 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="icon-sm" variant="ghost" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}><Plus className="h-4 w-4" /></Button>
        </span>
      </div>
      {!doc || !width ? (
        <Skeleton className="m-4 h-[60vh] rounded-md" />
      ) : (
        <div className={clsx("flex flex-col gap-4 p-4", zoom > 1 ? "items-start overflow-x-auto" : "items-center")}>
          {Array.from({ length: doc.numPages }, (_, i) => <Page key={i + 1} doc={doc} n={i + 1} width={pageWidth} />)}
        </div>
      )}
    </div>
  );
}

function Page({ doc, n, width }: { doc: PDFDocumentProxy; n: number; width: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // the first pages draw at once, the rest once scrolled near
  const [seen, setSeen] = useState(n <= 2);
  // height over width, so the page takes its room before it is drawn
  const [ratio, setRatio] = useState<number>();

  useEffect(() => {
    let live = true;
    doc.getPage(n).then((p) => {
      const v = p.getViewport({ scale: 1 });
      if (live) setRatio(v.height / v.width);
    });
    return () => void (live = false);
  }, [doc, n]);

  useEffect(() => {
    const el = canvas.current;
    if (seen || !el) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setSeen(true), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!seen) return;
    let live = true;
    let task: RenderTask | undefined;
    doc.getPage(n).then((page) => {
      const c = canvas.current;
      if (!live || !c) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = width / page.getViewport({ scale: 1 }).width;
      const vp = page.getViewport({ scale: scale * dpr });
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      task = page.render({ canvas: c, viewport: vp });
      // a page still drawing when the zoom changes is cancelled, which rejects
      task.promise.catch(() => {});
    });
    return () => {
      live = false;
      task?.cancel();
    };
  }, [doc, n, width, seen]);

  return <canvas ref={canvas} aria-label={`Page ${n}`} className="block shrink-0 bg-white shadow-sm" style={{ width, height: ratio ? Math.floor(width * ratio) : width * 1.3 }} />;
}
