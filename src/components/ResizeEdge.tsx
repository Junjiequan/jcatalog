// A thin strip on one edge of a panel: drag it to widen or narrow the panel, double click to put it back. `grows` says which
// way a drag makes the panel wider: to the right for a panel on the left of the page, to the left for one on the right.
// `tone` colours the dot sitting on the line, which says this edge belongs to a side panel and tells the panels apart.
const DOT = { blue: "bg-accent/70", selection: "bg-selection/70", grey: "bg-line-strong" };
export function ResizeEdge({ side, grows, width, min, max, initial, onChange, label, tone = "grey" }: { tone?: keyof typeof DOT; side: "left" | "right"; grows: "right" | "left"; width: number; min: number; max: number; initial: number; onChange: (w: number) => void; label: string }) {
  return (
    <div
      tabIndex={0}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        const start = e.clientX;
        const base = width;
        // no text selection while the pointer sweeps across the page
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";
        const move = (ev: PointerEvent) => onChange(Math.max(min, Math.min(max, base + (grows === "right" ? 1 : -1) * (ev.clientX - start))));
        const up = () => {
          document.body.style.userSelect = "";
          document.body.style.cursor = "";
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const dir = (e.key === "ArrowRight" ? 1 : -1) * (grows === "right" ? 1 : -1);
        onChange(Math.max(min, Math.min(max, width + dir * 24)));
      }}
      onDoubleClick={() => onChange(initial)}
      className={`group/edge absolute inset-y-0 z-10 w-2 cursor-col-resize hover:bg-accent/30 focus-visible:bg-accent/30 active:bg-accent/40 ${side === "right" ? "-right-1" : "-left-1"}`}
    >
      <span aria-hidden className={`pointer-events-none absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-surface transition-transform group-hover/edge:scale-y-125 ${DOT[tone]}`} />
    </div>
  );
}
