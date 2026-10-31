import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { api } from "@/api";
import { renderApp, resetApp } from "@/test/app";
import { actionsFor, applies, BULK_ACTIONS, GENERAL_ACTIONS } from "./bulkActions";
import { useSelection, type SelItem } from "@/store/selection";

afterEach(resetApp);

const dataset = (id: string, over: Partial<SelItem> = {}): SelItem => ({ kind: "dataset", id, name: `Run ${id}`, link: `/datasets/${id}`, size: 1000, files: 3, ...over });
const proposal: SelItem = { kind: "proposal", id: "20240311", name: "A proposal", link: "/proposals/20240311" };

describe("which bulk actions apply", () => {
  it("offers 'Retrieve from archive' only when something selected is on tape", () => {
    expect(applies(BULK_ACTIONS.find((a) => a.id === "retrieve")!, [dataset("A")])).toBe(false);
    expect(applies(BULK_ACTIONS.find((a) => a.id === "retrieve")!, [dataset("A"), dataset("B", { archived: true })])).toBe(true);
  });

  it("each kind has its own actions, and PDF export is offered for every kind", () => {
    expect(actionsFor("dataset", [dataset("A")]).map((a) => a.id)).toEqual(expect.arrayContaining(["hdf", "pdf"]));
    expect(actionsFor("proposal", [proposal]).map((a) => a.id)).toEqual(["pdf"]);
  });

  it("copying identifiers and exporting a list are general: they work on anything", () => {
    expect(GENERAL_ACTIONS().map((a) => a.id)).toEqual(["copy", "csv"]);
  });

  it("an action runs on the part of the selection it belongs to, not on the rest", async () => {
    const retrieve = BULK_ACTIONS.find((a) => a.id === "retrieve")!;
    await api.auth.signInDemo!("admin@example.org");
    const spy = vi.spyOn(api.datasets, "requestRetrieval").mockResolvedValue({ id: "J" } as never);
    await retrieve.run([dataset("A"), dataset("B", { archived: true })], { nav: () => {} });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("B");
  });
});

describe("the selection bar's Actions menu", () => {
  const select = async (items: SelItem[]) => {
    const ctx = await renderApp("/datasets", { before: () => useSelection.getState().addItems(items) });
    await screen.findByText(`${items.length} selected`);
    return ctx;
  };

  it("copies the identifiers, comma separated", async () => {
    const { user } = await select([dataset("A"), dataset("B"), proposal]);
    await user.click(await screen.findByRole("button", { name: "Actions" }));
    await user.click(await screen.findByRole("menuitem", { name: /Copy identifiers/ }));
    expect(await screen.findByText("Copied 3 identifiers")).toBeInTheDocument();
    // user-event stands in for the clipboard
    expect(await navigator.clipboard.readText()).toBe("A, B, 20240311");
  });

  it("groups the entries by kind when the selection is mixed", async () => {
    const { user } = await select([dataset("A"), proposal]);
    await user.click(await screen.findByRole("button", { name: "Actions" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText(/datasets · 1/)).toBeInTheDocument();
    expect(within(menu).getByText(/proposals · 1/)).toBeInTheDocument();
    expect(within(menu).getByText(/Everything · 2/)).toBeInTheDocument();
  });

  it("with only one kind there are no group headings", async () => {
    const { user } = await select([dataset("A"), dataset("B")]);
    await user.click(await screen.findByRole("button", { name: "Actions" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).queryByText(/Everything/)).not.toBeInTheDocument();
  });
});
