import { useMemo, useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router";
import { AlertCircle, Eye, EyeOff, FlaskConical, LogIn, UserPlus } from "lucide-react";
import { Logo } from "@/components/Thumb";
import { Avatar, Field, RoleBadge, Segmented } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { DEMO_PASSWORD, SEED_ACCOUNTS } from "@/data/accounts";
import { detectorImageUrl } from "@/data/detectorImages";
import { useAuth } from "@/store/auth";
import type { Role } from "@/types";

type Mode = "in" | "up";

export default function LoginPage() {
  const { session, signIn, signUp } = useAuth();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? "/datasets";
  const [mode, setMode] = useState<Mode>("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [role, setRole] = useState<Role>("user");
  const [withDemoData, setWithDemoData] = useState(true);
  const [error, setError] = useState("");
  // a picture of what the catalogue holds, drawn once
  const hero = useMemo(() => detectorImageUrl(2024, "sans"), []);

  if (session) return <Navigate to={from} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const r = mode === "in" ? signIn(email, password) : signUp({ name, email, password, role, withDemoData });
    if (!r.ok) setError(r.error);
  };
  const demo = (e: string) => {
    setError("");
    signIn(e, DEMO_PASSWORD);
  };

  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[1.05fr_1fr]">
      {/* the brand side: only where there is room for it */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0a5fa8] via-[#0b7fc4] to-[#009de0] p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <Logo className="h-11 w-11 drop-shadow-[0_6px_14px_rgb(0_0_0/0.25)]" />
          <div className="flex flex-col leading-[1.18]">
            <span className="text-[22px] font-extrabold tracking-[-0.04em]">metadata</span>
            <span className="text-[22px] font-semibold tracking-[-0.04em] text-white/85">catalogue</span>
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight">Find, understand and share your neutron data.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/80">Datasets, proposals, samples and instruments in one place, with the detector images, scripts and notes that explain them.</p>
          <img src={hero} alt="" draggable={false} className="mt-8 aspect-[8/5] w-full max-w-sm rotate-[-2deg] rounded-2xl border border-white/25 object-cover shadow-[0_24px_60px_-18px_rgb(0_0_0/0.55)]" />
        </div>
        <p className="text-xs text-white/60">European Spallation Source · demonstration catalogue</p>
        <span className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Logo className="h-10 w-10" />
            <div className="flex flex-col leading-[1.18]">
              <span className="bg-gradient-to-r from-brand to-accent-deep bg-clip-text text-lg font-extrabold tracking-[-0.04em] text-transparent">metadata</span>
              <span className="text-lg font-semibold tracking-[-0.04em]">catalogue</span>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">{mode === "in" ? "Sign in" : "Create a test account"}</h2>
          <p className="mt-1.5 text-sm text-muted">{mode === "in" ? "Welcome back. Use your account, or one of the demo accounts below." : "For trying the catalogue. The account lives only in this browser."}</p>

          <Segmented className="mt-6" stretch value={mode} onChange={(v: Mode) => (setMode(v), setError(""))} options={[{ value: "in", label: "Sign in" }, { value: "up", label: "Create test account" }]} />

          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            {mode === "up" && <Field label="Name"><input className="field h-11" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Jane Doe" autoFocus /></Field>}
            <Field label="Email"><input className="field h-11" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.org" autoFocus={mode === "in"} /></Field>
            <Field label="Password" hint={mode === "up" ? "At least 8 characters." : undefined}>
              <div className="relative">
                <input className="field h-11 pr-11" type={show ? "text" : "password"} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-md text-subtle hover:text-fg">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {mode === "up" && (
              <>
                <Field label="Account type" hint="Test accounts can be either. An administrator can see and change everything.">
                  <Segmented stretch value={role} onChange={(v: Role) => setRole(v)} options={[{ value: "user", label: "User" }, { value: "admin", label: "Administrator" }]} />
                </Field>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
                  <input type="checkbox" checked={withDemoData} onChange={(e) => setWithDemoData(e.target.checked)} className="mt-0.5" />
                  <span><span className="font-medium">Start with sample data</span><span className="block text-xs text-muted">Joins the sample research groups, so there are datasets and proposals to look at. Leave it off for an empty account.</span></span>
                </label>
              </>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full">
              {mode === "in" ? <><LogIn className="h-4 w-4" />Sign in</> : <><UserPlus className="h-4 w-4" />Create account and sign in</>}
            </Button>
          </form>

          <div className="mt-8">
            <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-subtle"><span className="h-px flex-1 bg-line" />Demo accounts<span className="h-px flex-1 bg-line" /></div>
            <ul className="space-y-2">
              {SEED_ACCOUNTS.map((a) => (
                <li key={a.email}>
                  <button type="button" onClick={() => demo(a.email)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-accent hover:bg-accent-soft/40">
                    <Avatar name={a.name} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold">{a.name}<RoleBadge role={a.role} /></span>
                      <span className="mt-0.5 block truncate text-xs text-muted">{a.blurb}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-subtle"><FlaskConical className="h-3.5 w-3.5" />Test environment · accounts are stored in this browser only</p>
          </div>
        </div>
      </main>
    </div>
  );
}
