import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router";
import { queryClient } from "@/api/hooks";
import App from "@/App";
import { useAuth } from "@/store/auth";
import { useConfirmStore } from "@/store/confirm";
import { useToasts } from "@/store/toasts";
import { useSelection } from "@/store/selection";
import { useUI } from "@/store/ui";

// The whole app against the in-memory mock backend, the way a person meets it.
// Accounts of the mock: the administrator, Ada (owns bio-sax, ada-lab) and Henrik (nilsson-mat).
export const ACCOUNTS = { admin: "admin@example.org", ada: "ada.okafor@example.org", henrik: "henrik.nilsson@example.org" } as const;

export async function signInAs(who: keyof typeof ACCOUNTS | null) {
  if (!who) return useAuth.getState().signOut();
  const r = await useAuth.getState().signInDemo(ACCOUNTS[who]);
  if (!r.ok) throw new Error(r.error);
}

// the URL is shown, so a test can check where a click led
const Where = () => {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
};

// `before` runs once signed in and before the first render: signing in clears the selection, so state a test needs goes here
export async function renderApp(path = "/datasets", { as = "admin", before }: { as?: keyof typeof ACCOUNTS | null; before?: () => void } = {}) {
  // a failed read shows its error at once instead of being retried first
  queryClient.setDefaultOptions({ queries: { ...queryClient.getDefaultOptions().queries, retry: false } });
  await signInAs(as);
  before?.();
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { user, ...view };
}

// what one test leaves behind must not reach the next
export async function resetApp() {
  await useAuth.getState().signOut();
  queryClient.clear();
  useSelection.getState().clear();
  useConfirmStore.setState({ current: null });
  useToasts.setState({ items: [] });
  useUI.setState(useUI.getInitialState());
  localStorage.clear();
}
