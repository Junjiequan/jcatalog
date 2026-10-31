import { describe, expect, it } from "vitest";
import { confirm, useConfirmStore } from "./confirm";

describe("confirm", () => {
  it("resolves true when confirmed and false when cancelled", async () => {
    const yes = confirm({ title: "Delete?", description: "Gone for good." });
    expect(useConfirmStore.getState().current?.title).toBe("Delete?");
    useConfirmStore.getState().close(true);
    await expect(yes).resolves.toBe(true);

    const no = confirm({ title: "Again?", description: "" });
    useConfirmStore.getState().close(false);
    await expect(no).resolves.toBe(false);
    expect(useConfirmStore.getState().current).toBeNull();
  });
});
