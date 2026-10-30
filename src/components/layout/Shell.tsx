import { useEffect, useRef, type ReactElement } from "react";
import { useAuth } from "@/store/auth";
import { canCreateDatasets, useRole } from "@/lib/permissions";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import clsx from "clsx";
import { Eye, EyeOff, Keyboard, LogOut, MoreHorizontal, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, ShoppingBasket, Sun } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Avatar, Kbd, AccountAvatar, RoleBadge } from "@/components/ui/Primitives";
import { Menu, MenuItem, MenuLabel, MenuRadio, MenuSep, Tip } from "@/components/ui/Overlay";
import { Logo } from "@/components/Thumb";
import { NAV, MOD } from "./nav";
import { CommandPalette } from "./CommandPalette";
import { ConfirmHost, SelectionSheet, SelectionTray, ShortcutsDialog, ToastHost } from "./Overlays";
import { CreateDatasetDialog } from "@/features/datasets/CreateDatasetDialog";
import { useUI, type Theme } from "@/store/ui";
import { useSelection } from "@/store/selection";
import { useHotkeys, useMediaQuery } from "@/hooks/hooks";
import { currentUser } from "@/lib/session";
import { bus } from "@/lib/bus";
import { toast } from "@/store/toasts";
import { datasetLink } from "@/lib/query";
import type { Job } from "@/types";

function Sidebar() {
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const set = useUI((s) => s.set);
  const count = useSelection((s) => Object.keys(s.items).length);
  const trayHidden = useUI((s) => s.trayHidden);
  const { pathname } = useLocation();
  // plain class strings on purpose: a function className is lost when the tooltip's asChild merges props
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  // items have the same shape in both states (icon fixed at the left), so only the width animates and the labels fade
  const link = (active: boolean) =>
    clsx(
      "group relative flex h-10 items-center gap-3 whitespace-nowrap rounded-lg px-[13px] text-[13.5px] font-medium transition-colors",
      active ? "bg-accent-soft text-accent shadow-[inset_3px_0_0_0_rgb(var(--brand))]" : "text-muted hover:bg-surface-3/70 hover:text-fg",
    );
  const fade = clsx("transition-opacity duration-150", collapsed ? "opacity-0" : "opacity-100 delay-100");

  // always wrapped, so toggling the sidebar never remounts the items
  const wrap = (label: string, node: ReactElement) => <Tip key={label} label={label} side="right" disabled={!collapsed}>{node}</Tip>;

  return (
    <aside className={clsx("hidden shrink-0 flex-col overflow-x-hidden border-r border-line bg-canvas transition-[width] duration-200 ease-out lg:flex", collapsed ? "w-[69px]" : "w-[249px]")}>
      <Link to="/datasets" className="flex h-14 shrink-0 items-center gap-2.5 whitespace-nowrap pl-5">
        <Logo className="h-8 w-8 shrink-0 drop-shadow-[0_3px_6px_rgb(0_157_224/0.35)]" />
        <span className={clsx("flex flex-col leading-[1.18]", fade)}>
          <span className="whitespace-nowrap bg-gradient-to-r from-brand to-accent-deep bg-clip-text pb-px text-[17px] font-extrabold tracking-[-0.04em] text-transparent">Metadata</span>
          <span className="whitespace-nowrap pb-0.5 text-[17px] font-semibold tracking-[-0.04em] text-fg">Catalog</span>
        </span>
      </Link>

      {/* a slim header for the menu with the toggle on it: icon only, set apart by rules */}
      <div className="relative h-10 shrink-0 border-y border-line">
        <span className={clsx("side-title absolute left-5 top-1/2 -translate-y-1/2", fade)}>Browse</span>
        <Tip label={collapsed ? "Expand sidebar" : "Collapse sidebar"} kbd="[" side="right">
          <button
            onClick={() => set({ sidebarCollapsed: !collapsed })}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={clsx(
              "absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-surface-3 text-muted transition-[right,color,background-color] duration-200 ease-out hover:bg-accent-soft hover:text-accent",
              collapsed ? "right-5" : "right-3",
            )}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" strokeWidth={1.8} /> : <PanelLeftClose className="h-4 w-4" strokeWidth={1.8} />}
          </button>
        </Tip>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-2">
        {NAV.map((n) =>
          wrap(
            n.label,
            <NavLink key={n.to} to={n.to} className={link(isActive(n.to))}>
              <n.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              <span className={fade}>{n.label}</span>
              {!collapsed && <span className="ml-auto text-[10px] font-medium text-subtle opacity-0 transition-opacity group-hover:opacity-100">g {n.key}</span>}
            </NavLink>,
          ),
        )}

      </nav>

      <div className="space-y-1 border-t border-line p-3">
        {wrap(
          "Selection",
          <div className="relative flex items-center gap-1">
            <button onClick={() => set({ selectionOpen: true })} className={clsx(link(false), "min-w-0 flex-1")}>
              <ShoppingBasket className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              <span className={fade}>Selection</span>
              {count > 0 && (
                <span className={clsx("rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-fg", collapsed ? "absolute right-0.5 top-0.5" : "ml-auto")}>{count}</span>
              )}
            </button>
            {/* the same eye as on the floating bar: fold it away, or bring it back */}
            {!collapsed && count > 0 && (
              <Tip label={trayHidden ? "Show the selection bar" : "Hide the selection bar"}>
                <button onClick={() => set({ trayHidden: !trayHidden })} aria-label={trayHidden ? "Show the selection bar" : "Hide the selection bar"} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-surface-3 hover:text-fg">
                  {trayHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </Tip>
            )}
          </div>,
        )}
        {wrap(
          "Settings",
          <NavLink to="/settings" className={link(isActive("/settings"))}>
            <Settings className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
            <span className={fade}>Settings</span>
          </NavLink>,
        )}
        {/* where a new user finds out there are shortcuts at all */}
        {wrap(
          "Keyboard shortcuts",
          <button onClick={() => set({ shortcutsOpen: true })} className={clsx(link(false), "w-full")}>
            <Keyboard className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
            <span className={fade}>Keyboard shortcuts</span>
            {!collapsed && <span className="ml-auto"><Kbd>?</Kbd></span>}
          </button>,
        )}
      </div>
    </aside>
  );
}

function ThemeMenu() {
  const theme = useUI((s) => s.theme);
  const set = useUI((s) => s.set);
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <Menu trigger={<Button variant="ghost" size="icon" aria-label="Theme"><Icon className="h-[18px] w-[18px]" /></Button>}>
      <MenuLabel>Appearance</MenuLabel>
      <MenuRadio value={theme} onValueChange={(v) => set({ theme: v as Theme })} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
    </Menu>
  );
}

function Topbar() {
  useRole();
  const set = useUI((s) => s.set);
  const count = useSelection((s) => Object.keys(s.items).length);
  // rendered, not hidden with a class: the Button's own display class would win over "hidden"
  const wide = useMediaQuery("(min-width: 640px)");
  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-canvas/85 px-3 backdrop-blur-sm sm:gap-3 sm:px-5">
      <Link to="/datasets" className="lg:hidden"><Logo className="h-8 w-8" /></Link>
      {/* icon only, like Linear or Vercel: the page's own search box is the only place that looks like a field */}
      <Tip label="Search everything" kbd={`${MOD}K`}>
        <Button variant="ghost" size="icon" aria-label="Search everything" onClick={() => set({ paletteOpen: true })}><Search className="h-[18px] w-[18px]" /></Button>
      </Tip>
      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
        {canCreateDatasets() && (wide ? (
          <Button variant="primary" size="md" onClick={() => set({ createOpen: true })}>
            <Plus className="h-4 w-4" /> New dataset
          </Button>
        ) : (
          <Button variant="primary" size="icon" aria-label="New dataset" onClick={() => set({ createOpen: true })}><Plus className="h-4 w-4" /></Button>
        ))}
        <Tip label="Selection">
          <Button variant="ghost" size="icon" className="relative lg:hidden" aria-label="Selection" onClick={() => set({ selectionOpen: true })}>
            <ShoppingBasket className="h-[18px] w-[18px]" />
            {count > 0 && <span className="absolute right-0.5 top-0.5 rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-fg">{count}</span>}
          </Button>
        </Tip>
        <div className="hidden sm:block"><ThemeMenu /></div>
        <Menu trigger={<button className="ml-1 shrink-0 rounded-full outline-offset-2" aria-label="Account"><AccountAvatar name={currentUser().name} role={currentUser().role} size={32} /></button>}>
          <div className="px-2.5 py-2">
            <div className="flex items-center gap-2"><span className="truncate text-sm font-medium">{currentUser().name}</span><RoleBadge role={currentUser().role} /></div>
            <div className="text-xs text-muted">{currentUser().email}</div>
          </div>
          <MenuSep />
          <UserMenuLinks />
        </Menu>
      </div>
    </header>
  );
}

function UserMenuLinks() {
  const nav = useNavigate();
  return (
    <>
      <MenuItem icon={Settings} onSelect={() => nav("/settings")}>Settings</MenuItem>
      <MenuSep />
      <MenuItem icon={LogOut} onSelect={() => { useAuth.getState().signOut(); nav("/login", { replace: true }); toast.info("Signed out"); }}>Sign out</MenuItem>
    </>
  );
}

function MobileNav() {
  const first = NAV.slice(0, 4);
  const rest = NAV.slice(4);
  const nav = useNavigate();
  return (
    <nav className="z-30 flex shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      {first.map((n) => (
        <NavLink key={n.to} to={n.to} className={({ isActive }) => clsx("flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium", isActive ? "text-accent" : "text-muted")}>
          <n.icon className="h-5 w-5" strokeWidth={1.8} />
          {n.label}
        </NavLink>
      ))}
      <Menu align="end" trigger={<button className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium text-muted"><MoreHorizontal className="h-5 w-5" strokeWidth={1.8} />More</button>}>
        {rest.map((n) => <MenuItem key={n.to} icon={n.icon} onSelect={() => nav(n.to)}>{n.label}</MenuItem>)}
        <MenuItem icon={Settings} onSelect={() => nav("/settings")}>Settings</MenuItem>
      </Menu>
    </nav>
  );
}

function useGlobalShortcuts() {
  const nav = useNavigate();
  const set = useUI((s) => s.set);
  const chord = useRef<number>(0);
  useHotkeys({
    "mod+k": (e) => {
      e.preventDefault();
      set({ paletteOpen: !useUI.getState().paletteOpen });
    },
    "?": () => set({ shortcutsOpen: true }),
    c: () => canCreateDatasets() && set({ createOpen: true }),
    "[": () => set({ sidebarCollapsed: !useUI.getState().sidebarCollapsed }),
    g: () => (chord.current = Date.now()),
    ...Object.fromEntries(
      NAV.map((n) => [n.key, () => {
        if (Date.now() - chord.current < 900) {
          chord.current = 0;
          nav(n.to);
        }
      }]),
    ),
  });
}

function JobWatcher() {
  const nav = useNavigate();
  useEffect(() => {
    const on = (e: Event) => {
      const job = (e as CustomEvent<Job>).detail;
      const name = job.datasetNames[0] + (job.datasetNames.length > 1 ? ` +${job.datasetNames.length - 1} more` : "");
      if (job.type === "retrieve") toast.success("Dataset is back online", { description: name, action: { label: "Open", onClick: () => nav(datasetLink(job.jobParams.datasetList[0].pid)) } });
      else if (job.type === "download") toast.success("Your download is ready", { description: name, action: { label: "View jobs", onClick: () => nav("/jobs") } });
      else toast.success(`Job ${job.id} finished`);
    };
    bus.addEventListener("job-done", on);
    return () => bus.removeEventListener("job-done", on);
  }, [nav]);
  return null;
}

export function AppShell() {
  const theme = useUI((s) => s.theme);
  const { pathname } = useLocation();
  useGlobalShortcuts();

  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && mq.matches));
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  return (
    <div className="flex h-dvh overflow-clip">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main key={pathname.split("/")[1]} className="min-h-0 flex-1 overflow-y-auto overflow-x-clip">
          <Outlet />
        </main>
        <MobileNav />
      </div>
      <SelectionTray />
      <SelectionSheet />
      <CommandPalette />
      <CreateDatasetDialog />
      <ShortcutsDialog />
      <ConfirmHost />
      <ToastHost />
      <JobWatcher />
    </div>
  );
}
