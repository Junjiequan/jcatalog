import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { TipProvider } from "@/components/ui/Overlay";

// Shows where the router is, so a test can check what a click navigated to
export const Where = () => {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
};

// A component inside what the app wraps every page in: a router (starting at `at`) and the tooltips
export function renderInApp(ui: ReactElement, { at = "/" }: { at?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <TipProvider>
        {ui}
        <Where />
      </TipProvider>
    </MemoryRouter>,
  );
}
