import { ShieldCheck } from "lucide-react";
import { Badge } from "./badges";

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const ini = name.replace(/^(Dr\.|Prof\.)\s*/, "").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${hue} 65% 52%), hsl(${(hue + 40) % 360} 65% 42%))` }}
    >
      {ini}
    </span>
  );
}

// Who is signed in, said the same way everywhere: an administrator is unmistakable, a user is plain
export function RoleBadge({ role, className }: { role: "admin" | "user"; className?: string }) {
  return role === "admin" ? <Badge tone="accent" icon={ShieldCheck} className={className}>Administrator</Badge> : <Badge className={className}>User</Badge>;
}

// the avatar, with a small shield on it for an administrator
export function AccountAvatar({ name, role, size = 32 }: { name: string; role: "admin" | "user"; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar name={name} size={size} />
      {role === "admin" && <span className="absolute -bottom-1 -right-1 flex h-[40%] min-h-4 w-[40%] min-w-4 items-center justify-center rounded-full bg-accent text-accent-fg ring-2 ring-canvas" title="Administrator"><ShieldCheck className="h-2.5 w-2.5" strokeWidth={2.6} /></span>}
    </span>
  );
}
