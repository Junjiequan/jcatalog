import { create } from "zustand";

export interface ConfirmOpts {
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
  bullets?: string[];
}

interface ConfirmState {
  current: (ConfirmOpts & { resolve: (ok: boolean) => void }) | null;
  close: (ok: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  current: null,
  close: (ok) => {
    get().current?.resolve(ok);
    set({ current: null });
  },
}));

export const confirm = (opts: ConfirmOpts) =>
  new Promise<boolean>((resolve) => useConfirmStore.setState({ current: { ...opts, resolve } }));
