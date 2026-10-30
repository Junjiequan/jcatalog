import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CURRENT_USER } from "@/data/db";
import { SEED_ACCOUNTS, hashPassword, type Account } from "@/data/accounts";
import { queryClient } from "@/api/hooks";
import { useSelection } from "@/store/selection";
import type { Role } from "@/types";

export interface Session {
  email: string;
  name: string;
  role: Role;
}
export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  // join the sample groups, so the account starts with data to look at
  withDemoData: boolean;
}
type Result = { ok: true } | { ok: false; error: string };

interface AuthState {
  // accounts created here (the demo accounts are fixed and always there)
  accounts: Account[];
  session: Session | null;
  signIn: (email: string, password: string) => Result;
  signUp: (input: SignUpInput) => Result;
  signOut: () => void;
}

const findAccount = (accounts: Account[], email: string) => [...SEED_ACCOUNTS, ...accounts].find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
const slug = (s: string) => s.replace(/^(Dr\.|Prof\.)\s*/i, "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// the data layer reads who is acting from CURRENT_USER
function apply(a: { name: string; email: string; role: Role; groups: string[] } | null) {
  Object.assign(CURRENT_USER, a ?? { name: "", email: "", role: "user" as Role, groups: [] });
}
// another person must never see the previous person's cached results or selection
function resetCaches() {
  queryClient.clear();
  useSelection.getState().clear();
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      accounts: [],
      session: null,
      signIn: (email, password) => {
        const a = findAccount(get().accounts, email);
        // one message for both cases, so the form does not reveal which emails exist
        if (!a || a.passwordHash !== hashPassword(a.email, password)) return { ok: false, error: "That email and password don't match an account." };
        resetCaches();
        apply(a);
        set({ session: { email: a.email, name: a.name, role: a.role } });
        return { ok: true };
      },
      signUp: (input) => {
        const name = input.name.trim();
        const email = input.email.trim().toLowerCase();
        if (name.length < 2) return { ok: false, error: "Enter your name." };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
        if (input.password.length < 8) return { ok: false, error: "Use at least 8 characters for the password." };
        if (findAccount(get().accounts, email)) return { ok: false, error: "There is already an account with that email. Sign in instead." };
        const a: Account = {
          name,
          email,
          role: input.role,
          groups: input.withDemoData ? ["bio-sax", "ada-lab"] : [`${slug(name) || "test"}-lab`],
          passwordHash: hashPassword(email, input.password),
        };
        set({ accounts: [...get().accounts, a] });
        resetCaches();
        apply(a);
        set({ session: { email: a.email, name: a.name, role: a.role } });
        return { ok: true };
      },
      signOut: () => {
        resetCaches();
        apply(null);
        set({ session: null });
      },
    }),
    { name: "metadatacatalogue.auth", partialize: (s) => ({ accounts: s.accounts, session: s.session }) },
  ),
);

// a returning visitor is still signed in
{
  const { session, accounts } = useAuth.getState();
  const a = session && findAccount(accounts, session.email);
  if (a) apply(a);
  else if (session) useAuth.setState({ session: null });
}
