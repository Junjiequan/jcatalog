import type { Role } from "@/types";

// Accounts for the test environment. A real deployment signs in through the facility's identity provider; here they live in this browser.
export interface Account {
  name: string;
  email: string;
  role: Role;
  groups: string[];
  passwordHash: string;
  // a line on the login page saying what this account sees
  blurb?: string;
}

// not cryptography: it only keeps a typed password out of storage in this mock (cyrb53)
export function hashPassword(email: string, password: string): string {
  const s = `${email.trim().toLowerCase()}:${password}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// the password of the three demo accounts below (also what the one-click buttons use)
export const DEMO_PASSWORD = "Demo-2026-pass";

const demo = (name: string, email: string, role: Role, groups: string[], blurb: string): Account => ({ name, email, role, groups, blurb, passwordHash: hashPassword(email, DEMO_PASSWORD) });

export const SEED_ACCOUNTS: Account[] = [
  demo("Facility Administrator", "admin@example.org", "admin", ["facility-admin"], "Sees every dataset, can create datasets and manage any group's data"),
  demo("Dr. Ada Okafor", "ada.okafor@example.org", "user", ["bio-sax", "ada-lab"], "A user with her own datasets, proposals and shared data"),
  demo("Dr. Henrik Nilsson", "henrik.nilsson@example.org", "user", ["nilsson-mat"], "A user from a materials group; only sees what is shared with them"),
];
