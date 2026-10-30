import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import * as Dialog from "@radix-ui/react-dialog";
import * as DM from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Check, X, type LucideIcon } from "lucide-react";

export const TipProvider = ({ children }: { children: ReactNode }) => (
  <Tooltip.Provider delayDuration={600} skipDelayDuration={0} disableHoverableContent>{children}</Tooltip.Provider>
);

// Radix closes a tooltip on press and click and will not reopen it until the pointer has left and come back,
// which made tooltips on clickable tiles show "after a few tries". Closes caused by a press while the pointer is
// still on the trigger are ignored; leaving, blur and Escape-by-keyboard-away still close it.
function useStickyHover() {
  const [open, setOpen] = useState(false);
  const pressed = useRef(false);
  return {
    root: { open, onOpenChange: (o: boolean) => (o || !pressed.current) && setOpen(o) },
    trigger: { onPointerDownCapture: () => void (pressed.current = true), onPointerLeave: () => void (pressed.current = false) },
  };
}

// `disabled` keeps the wrapper (and so the child's identity) but never shows the tip
export function Tip({ label, children, side = "top", kbd, disabled }: { label: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right"; kbd?: string; disabled?: boolean }) {
  const h = useStickyHover();
  return (
    <Tooltip.Root {...h.root}>
      <Tooltip.Trigger asChild {...h.trigger}>{children}</Tooltip.Trigger>
      {!disabled && (
        <Tooltip.Portal>
          <Tooltip.Content side={side} sideOffset={6} className="z-[100] max-w-xs rounded-md bg-fg px-2 py-1 text-xs font-medium text-canvas shadow-pop animate-fade-in">
            {label}
            {kbd && <span className="ml-2 opacity-60">{kbd}</span>}
          </Tooltip.Content>
        </Tooltip.Portal>
      )}
    </Tooltip.Root>
  );
}

// A tooltip that explains a term: a title line, then a sentence or two in a card.
export function Explain({ title, text, icon: Icon, image, wide, large, delay = 800, children, side = "top" }: { title: ReactNode; text: ReactNode; icon?: LucideIcon; image?: ReactNode; wide?: boolean; large?: boolean; delay?: number; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  const h = useStickyHover();
  return (
    <Tooltip.Root delayDuration={delay} {...h.root}>
      <Tooltip.Trigger asChild {...h.trigger}>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side={side} sideOffset={8} collisionPadding={12} className={clsx("z-[100] rounded-xl border border-line bg-surface p-3 text-left shadow-pop animate-scale-in", image ? (wide ? "w-[min(56rem,calc(100vw-1.5rem))]" : large ? "w-[min(36rem,calc(100vw-1.5rem))]" : "w-[min(22rem,calc(100vw-1.5rem))]") : "w-64")}>
          {image && <div className="-mx-3 -mt-3 mb-2.5 overflow-hidden rounded-t-xl border-b border-line">{image}</div>}
          <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
            {Icon && <Icon className="h-4 w-4 text-accent" strokeWidth={1.8} />}
            {title}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>
          {/* an open path: the two slanted sides carry the card's border colour, the base stays open into the card */}
          <Tooltip.Arrow asChild>
            <svg width="16" height="8" viewBox="0 0 16 8" className="-mt-px overflow-visible">
              <path d="M0 0 L8 8 L16 0" className="fill-surface stroke-line" strokeWidth="1" strokeLinejoin="round" />
            </svg>
          </Tooltip.Arrow>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// A card that opens on hover (or tap on a touch screen) and stays open while the pointer is on it
function HoverPop({ trigger, title, children }: { trigger: (p: { open: boolean; onMouseEnter: () => void; onMouseLeave: () => void }) => ReactNode; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const later = (v: boolean) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(v), v ? 120 : 160);
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger({ open, onMouseEnter: () => later(true), onMouseLeave: () => later(false) }) as React.ReactElement}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onMouseEnter={() => later(true)}
          onMouseLeave={() => later(false)}
          onClick={(e) => e.stopPropagation()}
          className="z-[100] w-max max-w-[min(24rem,calc(100vw-1.5rem))] rounded-xl border border-line bg-surface p-3 shadow-pop outline-hidden animate-scale-in"
        >
          <div className="section-title mb-2">{title}</div>
          <div className="flex flex-wrap items-center gap-1.5 whitespace-normal text-[13px] font-normal normal-case tracking-normal">{children}</div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// The "+N" at the end of a clipped list of chips: hover (or tap) shows the whole list, not only what was hidden.
// Shared by every chip list, so overflow behaves the same everywhere. No border: it is a plain label.
export function MoreChip({ count, title, tone = "accent", children }: { count: number; title: string; tone?: "accent" | "muted"; children: ReactNode }) {
  return (
    <HoverPop
      title={title}
      trigger={(p) => (
        <button
          type="button"
          aria-label={`Show all, ${count} more`}
          onMouseEnter={p.onMouseEnter}
          onMouseLeave={p.onMouseLeave}
          onClick={(e) => e.stopPropagation()}
          className={clsx("inline-flex shrink-0 items-center rounded px-0.5 text-[11px] font-semibold outline-hidden hover:underline focus-visible:underline", tone === "accent" ? "text-accent" : "text-muted hover:text-fg")}
        >
          +{count}
        </button>
      )}
    >
      {children}
    </HoverPop>
  );
}

// A one-line row that may be cut off: when it is, a "…" appears at the end and hovering (or tapping) it shows the whole thing, wrapped.
export function ClipRow({ children, full, title = "Full details", className }: { children: ReactNode; full?: ReactNode; title?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setClipped(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  });
  return (
    <div className={clsx("relative min-w-0", className)}>
      <div ref={ref} className="overflow-hidden whitespace-nowrap">{children}</div>
      {clipped && (
        <HoverPop
          title={title}
          trigger={(p) => (
            <button type="button" aria-label="Show everything" onMouseEnter={p.onMouseEnter} onMouseLeave={p.onMouseLeave} onClick={(e) => e.stopPropagation()} className="absolute inset-y-0 right-0 flex items-center bg-surface pl-1.5 pr-0.5 text-sm font-semibold leading-none text-muted outline-hidden hover:text-fg">…</button>
          )}
        >
          {full ?? children}
        </HoverPop>
      )}
    </div>
  );
}

const SIZES = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl", "2xl": "max-w-6xl" };

export function Modal({ open, onOpenChange, title, description, children, footer, size = "md", bare }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZES;
  bare?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className={clsx("fixed inset-0 z-50 m-auto flex h-fit max-h-[min(90dvh,860px)] w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop outline-hidden data-[state=open]:animate-scale-in", SIZES[size])}
        >
          {bare ? (
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
          ) : (
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
                {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
              </div>
              <Dialog.Close className="-mr-1.5 -mt-1 rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-fg"><X className="h-4 w-4" /></Dialog.Close>
            </div>
          )}
          <div className={clsx("min-h-0 flex-1 overflow-y-auto", !bare && "px-5 py-4")}>{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Sheet({ open, onOpenChange, title, side = "right", width = "sm:w-[440px]", children, footer, noOverlay }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  side?: "right" | "left" | "bottom";
  width?: string;
  children: ReactNode;
  footer?: ReactNode;
  noOverlay?: boolean;
}) {
  const pos = {
    right: "right-0 top-0 h-dvh w-full border-l animate-slide-in-right " + width,
    left: "left-0 top-0 h-dvh w-[88%] max-w-sm border-r animate-slide-in-left",
    bottom: "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl border-t animate-slide-up",
  }[side];
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {!noOverlay && <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40 data-[state=open]:animate-fade-in" />}
        <Dialog.Content aria-describedby={undefined} className={clsx("fixed z-50 flex flex-col border-line bg-surface shadow-pop outline-hidden", pos)}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-fg"><X className="h-4 w-4" /></Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <div className="border-t border-line p-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// `tip` puts a hover tooltip on the trigger, for icon-only buttons
export function Menu({ trigger, children, align = "end", tip }: { trigger: ReactNode; children: ReactNode; align?: "start" | "end" | "center"; tip?: string }) {
  const t = <DM.Trigger asChild>{trigger}</DM.Trigger>;
  return (
    <DM.Root>
      {tip ? <Tip label={tip}>{t}</Tip> : t}
      <DM.Portal>
        <DM.Content align={align} sideOffset={6} className="z-[80] min-w-[210px] rounded-xl border border-line bg-surface p-1 shadow-pop outline-hidden data-[state=open]:animate-scale-in">
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

const itemCls = "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-hidden data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2";

export function MenuItem({ icon: Icon, children, onSelect, danger, kbd, disabled }: { icon?: LucideIcon; children: ReactNode; onSelect?: () => void; danger?: boolean; kbd?: string; disabled?: boolean }) {
  return (
    <DM.Item onSelect={onSelect} disabled={disabled} className={clsx(itemCls, danger && "text-danger")}>
      {Icon && <Icon className="h-4 w-4 opacity-70" />}
      <span className="flex-1">{children}</span>
      {kbd && <span className="text-[11px] text-subtle">{kbd}</span>}
    </DM.Item>
  );
}

export function MenuCheck({ checked, onCheckedChange, children }: { checked: boolean; onCheckedChange: (c: boolean) => void; children: ReactNode }) {
  return (
    <DM.CheckboxItem checked={checked} onCheckedChange={onCheckedChange} onSelect={(e) => e.preventDefault()} className={itemCls}>
      <span className="flex h-4 w-4 items-center justify-center">
        <DM.ItemIndicator><Check className="h-3.5 w-3.5 text-accent" /></DM.ItemIndicator>
      </span>
      {children}
    </DM.CheckboxItem>
  );
}

export function MenuRadio({ value, onValueChange, options }: { value: string; onValueChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <DM.RadioGroup value={value} onValueChange={onValueChange}>
      {options.map((o) => (
        <DM.RadioItem key={o.value} value={o.value} className={itemCls}>
          <span className="flex h-4 w-4 items-center justify-center">
            <DM.ItemIndicator><Check className="h-3.5 w-3.5 text-accent" /></DM.ItemIndicator>
          </span>
          {o.label}
        </DM.RadioItem>
      ))}
    </DM.RadioGroup>
  );
}

export const MenuSep = () => <DM.Separator className="my-1 h-px bg-line" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => <DM.Label className="section-title px-2.5 pb-1 pt-2">{children}</DM.Label>;

export function Pop({ trigger, children, open, onOpenChange, align = "start", className }: { trigger: ReactNode; children: ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void; align?: "start" | "end" | "center"; className?: string }) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align={align} sideOffset={8} collisionPadding={12} className={clsx("z-[80] rounded-xl border border-line bg-surface p-4 shadow-pop outline-hidden data-[state=open]:animate-scale-in", className)}>
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
