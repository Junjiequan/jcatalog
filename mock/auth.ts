import type { CatalogApi } from "@/api/types";
import type { AuthResult, AuthUser, Role } from "@/types";
import { DEMO_PASSWORD, SEED_ACCOUNTS, hashPassword, type Account } from "./accounts";
import { setUser } from "./session";

// accounts made through the test sign-up; the demo accounts are fixed and always there
const KEY = "metadatacatalogue.mock-accounts";
const created = (): Account[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
};
const find = (email: string) => [...SEED_ACCOUNTS, ...created()].find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
const profile = (a: Account): AuthUser => ({ name: a.name, email: a.email, role: a.role as Role, groups: a.groups });
const slug = (s: string) => s.replace(/^(Dr\.|Prof\.)\s*/i, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const signIn: CatalogApi["auth"]["signIn"] = async (email, password): Promise<AuthResult> => {
  const a = find(email);
  // one message for both cases, so the form does not reveal which emails exist
  if (!a || a.passwordHash !== hashPassword(a.email, password)) return { ok: false, error: "That email and password don't match an account." };
  setUser(profile(a));
  return { ok: true, user: profile(a) };
};

export const mockAuth: CatalogApi["auth"] = {
  signIn,
  signOut: async () => void setUser(null),
  restore: (u) => void setUser(u),
  demoAccounts: () => SEED_ACCOUNTS.map(({ name, email, role, blurb }) => ({ name, email, role, blurb: blurb ?? "" })),
  signInDemo: (email) => signIn(email, DEMO_PASSWORD),
  signUp: async (input): Promise<AuthResult> => {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (name.length < 2) return { ok: false, error: "Enter your name." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
    if (input.password.length < 8) return { ok: false, error: "Use at least 8 characters for the password." };
    if (find(email)) return { ok: false, error: "There is already an account with that email. Sign in instead." };
    const a: Account = { name, email, role: input.role, groups: input.withDemoData ? ["bio-sax", "ada-lab"] : [`${slug(name) || "test"}-lab`], passwordHash: hashPassword(email, input.password) };
    localStorage.setItem(KEY, JSON.stringify([...created(), a]));
    setUser(profile(a));
    return { ok: true, user: profile(a) };
  },
};
