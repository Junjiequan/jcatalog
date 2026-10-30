import type { AuthUser } from "@/types";

// The signed-in person, for code that is not a component (permissions, the default list scope).
// The auth store sets it; components should read the store so they redraw.
const NOBODY: AuthUser = { name: "", email: "", role: "user", groups: [] };
let current: AuthUser = NOBODY;
export const currentUser = (): AuthUser => current;
export const setCurrentUser = (u: AuthUser | null) => void (current = u ?? NOBODY);
