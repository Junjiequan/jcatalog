import { useRef } from "react";
import clsx from "clsx";
import { Search, X } from "lucide-react";
import { useHotkeys } from "@/hooks/hooks";
import { Kbd } from "./Primitives";

/**
 * The one search box used above every list, at one size. `/` focuses it, Esc clears it (then leaves it),
 * and the clear button replaces the shortcut hint once there is text.
 */
export function SearchInput({ value, onChange, placeholder = "Search…", className }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  useHotkeys({
    "/": (e) => {
      e.preventDefault();
      input.current?.focus();
    },
  });

  return (
    <div className={clsx("relative min-w-[240px] flex-1 sm:max-w-md", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
      <input
        ref={input}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          if (value) onChange("");
          else e.currentTarget.blur();
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="field pl-9 pr-10 [&::-webkit-search-cancel-button]:appearance-none"
      />
      <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center">
        {value ? (
          <button onClick={() => onChange("")} aria-label="Clear search" className="rounded-sm p-0.5 text-subtle hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        ) : (
          <Kbd>/</Kbd>
        )}
      </div>
    </div>
  );
}
