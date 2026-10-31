import { afterEach, describe, expect, it } from "vitest";
import { toast, useToasts } from "./toasts";

afterEach(() => useToasts.setState({ items: [] }));

describe("toasts", () => {
  it("successes go away on their own, errors stay until dismissed", () => {
    toast.success("Saved");
    toast.error("Could not save");
    const [ok, bad] = useToasts.getState().items;
    expect(ok.duration).toBeGreaterThan(0);
    expect(bad.duration).toBe(0);
  });

  it("shows at most the last few, so they never pile up", () => {
    for (let i = 0; i < 10; i++) toast.info(`n${i}`);
    expect(useToasts.getState().items.length).toBeLessThanOrEqual(4);
    expect(useToasts.getState().items.at(-1)?.title).toBe("n9");
  });

  it("dismisses one by its id", () => {
    const id = toast.info("a");
    toast.info("b");
    toast.dismiss(id);
    expect(useToasts.getState().items.map((t) => t.title)).toEqual(["b"]);
  });
});
