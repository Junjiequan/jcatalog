import { afterEach, describe, expect, it } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { DockProvider, SidePanel, usePanelWidth } from "./SidePanel";
import { useUI } from "@/store/ui";

afterEach(() => useUI.setState(useUI.getInitialState()));

describe("panel widths with both panels open", () => {
  it("one cannot be dragged so wide that the other loses its minimum or the page its room", () => {
    Object.defineProperty(window, "innerWidth", { value: 1500, configurable: true });
    useUI.setState({ previewWidth: 400, selectionWidth: 480, sidebarCollapsed: false, filtersOpen: false });
    const selection = renderHook(() => usePanelWidth("selectionWidth", true));
    const preview = renderHook(() => usePanelWidth("previewWidth", true));
    act(() => undefined);
    // the preview keeps at least its minimum, the page keeps its room, and the selection gives way
    expect(preview.result.current.width).toBeGreaterThanOrEqual(320);
    expect(selection.result.current.width).toBeLessThanOrEqual(selection.result.current.max);
    expect(selection.result.current.max).toBeLessThanOrEqual(1500 - 520 - 320);
    expect(selection.result.current.width + preview.result.current.width).toBeLessThanOrEqual(1500 - 520);
  });

  it("alone, a panel may go to its own maximum", () => {
    Object.defineProperty(window, "innerWidth", { value: 1600, configurable: true });
    useUI.setState({ previewWidth: 470, selectionWidth: 400, sidebarCollapsed: false, filtersOpen: false });
    const preview = renderHook(() => usePanelWidth("previewWidth", true));
    expect(preview.result.current.width).toBe(470);
    expect(preview.result.current.max).toBe(480);
  });
});

describe("where the panels sit", () => {
  it("the selection is the outermost panel, whichever was opened first", () => {
    Object.defineProperty(window, "innerWidth", { value: 2000, configurable: true });
    useUI.setState({ filtersOpen: false });
    const slot = document.createElement("div");
    document.body.appendChild(slot);
    render(
      <Tooltip.Provider>
      <DockProvider value={slot}>
        <SidePanel open onClose={() => {}} title="Selection" widthKey="selectionWidth"><p>s</p></SidePanel>
        <SidePanel open onClose={() => {}} title="Preview" widthKey="previewWidth"><p>p</p></SidePanel>
      </DockProvider>
      </Tooltip.Provider>,
    );
    const order = (name: string) => Number([...slot.querySelectorAll("aside")].find((a) => a.textContent?.includes(name))!.style.order);
    expect(order("Selection")).toBeGreaterThan(order("Preview"));
    slot.remove();
  });
});
