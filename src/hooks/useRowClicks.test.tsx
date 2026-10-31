import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRowClicks } from "./hooks";

const setup = (peek: string | null) => {
  const setPeek = vi.fn();
  const open = vi.fn();
  const { result } = renderHook(() => useRowClicks(peek, setPeek, open));
  return { setPeek, open, ...result.current };
};

describe("clicks and double clicks on a row or card", () => {
  it("a double click on a closed item previews it, ignores the second click, and opens the page", () => {
    const { click, dbl, setPeek, open } = setup(null);
    click("a", { detail: 1 });
    click("a", { detail: 2 });
    dbl("a");
    expect(setPeek).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith("a");
  });

  it("a double click on the open item closes its preview and does not leave the list", () => {
    const { click, dbl, setPeek, open } = setup("a");
    click("a", { detail: 1 });
    click("a", { detail: 2 });
    dbl("a");
    expect(setPeek).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });
});
