import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/api";
import { queryClient } from "@/api/hooks";
import { setCurrentUser } from "@/lib/session";
import { useSelection } from "@/store/selection";
import type { AuthResult, AuthUser, SignUpInput } from "@/types";

interface AuthState {
  session: AuthUser | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  signInDemo: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

// another person must never see the previous person's cached results or selection
function begin(r: AuthResult, set: (s: Partial<AuthState>) => void): AuthResult {
  if (r.ok) {
    queryClient.clear();
    useSelection.getState().clear();
    setCurrentUser(r.user);
    set({ session: r.user });
  }
  return r;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      signIn: async (email, password) => begin(await api.auth.signIn(email, password), set),
      signUp: async (input) => (api.auth.signUp ? begin(await api.auth.signUp(input), set) : { ok: false, error: "Sign-up isn't available here." }),
      signInDemo: async (email) => (api.auth.signInDemo ? begin(await api.auth.signInDemo(email), set) : { ok: false, error: "No demo accounts here." }),
      signOut: async () => {
        await api.auth.signOut();
        queryClient.clear();
        useSelection.getState().clear();
        setCurrentUser(null);
        set({ session: null });
      },
    }),
    { name: "metadatacatalogue.auth", partialize: (s) => ({ session: s.session }) },
  ),
);

// a returning visitor is still signed in
{
  const { session } = useAuth.getState();
  if (session && session.groups) {
    api.auth.restore?.(session);
    setCurrentUser(session);
  } else if (session) useAuth.setState({ session: null });
}
