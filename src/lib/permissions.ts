import { CURRENT_USER } from "@/data/db";
import { useAuth } from "@/store/auth";

// An administrator can do anything. Everyone else works inside the groups they belong to.
export const isAdmin = () => CURRENT_USER.role === "admin";
// edit, rename, share, publish, delete and attach to something owned by this group
export const canManage = (ownerGroup: string) => isAdmin() || CURRENT_USER.groups.includes(ownerGroup);
// datasets are registered by facility staff (or an ingestor on their behalf); only an administrator creates one by hand
export const canCreateDatasets = () => isAdmin();
// components call this so they redraw when someone signs in as somebody else
export const useRole = () => useAuth((s) => s.session?.role);
