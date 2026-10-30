import { create } from "zustand";

export interface ToastItem {
  id: number;
  kind: "success" | "error" | "info";
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface ToastState {
  items: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => number;
  dismiss: (id: number) => void;
}

let seq = 1;
export const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (t) => {
    const id = seq++;
    set((s) => ({ items: [...s.items.slice(-3), { ...t, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

type Opts = Partial<Pick<ToastItem, "description" | "action" | "duration">>;
const make = (kind: ToastItem["kind"], dur: number) => (title: string, o: Opts = {}) =>
  useToasts.getState().push({ kind, title, duration: dur, ...o });

// errors stay until dismissed so people can read and act on them
export const toast = {
  success: make("success", 5000),
  info: make("info", 5000),
  error: make("error", 0),
  dismiss: (id: number) => useToasts.getState().dismiss(id),
};
