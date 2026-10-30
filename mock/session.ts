import type { AuthUser } from "@/types";

// Who the mock backend treats as the signed-in person. (A real backend reads this from the request's token.)
export const user: AuthUser = { name: "", email: "", role: "user", groups: [] };
export const setUser = (u: AuthUser | null) => Object.assign(user, u ?? { name: "", email: "", role: "user", groups: [] });

// An administrator can do anything; everyone else works inside the groups they belong to.
export const isAdmin = () => user.role === "admin";
export const canManage = (ownerGroup: string) => isAdmin() || user.groups.includes(ownerGroup);
export const canCreateDatasets = () => isAdmin();
