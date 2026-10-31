import { useState } from "react";
import { X } from "lucide-react";

// the longest tag one can type; a longer one is cut when it is added (and any tag ends in "…" where it is shown)
export const MAX_TAG = 40;

export function TagInput({ value, onChange, placeholder, autoFocus }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  const add = (t: string) => {
    const v = t.trim().replace(/,/g, "").slice(0, MAX_TAG);
    if (v && !value.includes(v)) onChange([...value, v]);
    setText("");
  };
  return (
    <div className="field flex h-auto min-h-9 flex-wrap items-center gap-1.5 py-1.5">
      {value.map((t) => (
        <span key={t} className="inline-flex max-w-full items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent" title={t}>
          <span className="min-w-0 max-w-[12rem] truncate">{t}</span>
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input
        autoFocus={autoFocus}
        className="min-w-[110px] flex-1 bg-transparent text-sm outline-hidden placeholder:text-subtle"
        value={text}
        maxLength={MAX_TAG}
        placeholder={value.length ? "" : placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => add(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(text);
          } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
        }}
      />
    </div>
  );
}
