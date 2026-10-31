import { forwardRef, useState, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";
import { Check, Copy, Loader2 } from "lucide-react";
import { Tip } from "./Overlay";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "selection";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-linear-to-b from-accent to-accent-deep text-accent-fg shadow-xs hover:brightness-110 active:brightness-95",
  secondary: "bg-surface-3 text-fg hover:bg-line",
  outline: "border border-line bg-surface text-fg hover:border-line-strong hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger text-white hover:brightness-110",
  // the colour of everything to do with the selection
  selection: "bg-selection text-selection-fg shadow-xs hover:brightness-110 active:brightness-95",
};
const SIZES: Record<Size, string> = {
  // one step smaller than they were; a finger still gets the old size
  sm: "h-7 gap-1.5 px-2.5 text-xs pointer-coarse:h-8",
  md: "h-8 gap-1.5 px-3 text-[13px] pointer-coarse:h-9",
  lg: "h-10 gap-2 px-5 text-sm",
  icon: "h-8 w-8 pointer-coarse:h-9 pointer-coarse:w-9",
  "icon-sm": "h-6 w-6 pointer-coarse:h-7 pointer-coarse:w-7",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "outline", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

export function CopyButton({ text, className, label = "Copy" }: { text: string; className?: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Tip label={done ? "Copied!" : label}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard?.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        }}
        className={clsx("inline-flex h-6 w-6 items-center justify-center rounded-md text-subtle transition-colors hover:bg-surface-3 hover:text-fg", className)}
      >
        {done ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </Tip>
  );
}
