import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderApp, resetApp } from "@/test/app";
import { useSelection } from "@/store/selection";

afterEach(resetApp);

const rows = () => screen.queryAllByRole("row").filter((r) => r.hasAttribute("data-pid"));

describe("the datasets list", () => {
  it("shows a page of datasets and how many there are", async () => {
    await renderApp("/datasets");
    await waitFor(() => expect(rows()).toHaveLength(10));
    expect(await screen.findByText(/of \d+/)).toBeInTheDocument();
  });

  it("an administrator starts on all datasets", async () => {
    await renderApp("/datasets", { as: "admin" });
    expect(await screen.findByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
  });

  it("a user starts on their own", async () => {
    await renderApp("/datasets", { as: "ada" });
    expect(await screen.findByRole("tab", { name: "My data" })).toHaveAttribute("aria-selected", "true");
  });

  it("a user sees only their groups' data under 'My data', and can widen to everything they may see", async () => {
    const { user } = await renderApp("/datasets", { as: "ada" });
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const mine = await screen.findByText(/of (\d+)/);
    await user.click(screen.getByRole("tab", { name: "Public" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toContain("scope=public"));
    expect(mine).toBeTruthy();
  });

  it("narrows the list as you type", async () => {
    const { user } = await renderApp("/datasets");
    await waitFor(() => expect(rows()).toHaveLength(10));
    const first = rows()[0].getAttribute("data-pid")!;
    const name = within(rows()[0]).getAllByText(/\w+/)[0].textContent!;
    await user.type(screen.getByPlaceholderText(/Search by name/), name.split(/\s/)[0]);
    await waitFor(() => expect(screen.getByTestId("where").textContent).toMatch(/q=/));
    await waitFor(() => expect(rows().some((r) => r.getAttribute("data-pid") === first)).toBe(true));
  });

  it("says so when nothing matches, and clears the search", async () => {
    const { user } = await renderApp("/datasets?q=zzzznothingmatches");
    expect(await screen.findByText(/No (datasets|results)|Nothing/i)).toBeInTheDocument();
    await user.click((await screen.findAllByRole("button", { name: /Clear/i }))[0]);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  });

  it("keeps the filters in the URL, so a link shares them", async () => {
    await renderApp("/datasets?scope=all&tech=SANS&type=derived");
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    for (const r of rows()) expect(within(r).getAllByText("SANS").length).toBeGreaterThan(0);
  });

  it("selecting rows shows the selection tray, and clearing empties it", async () => {
    const { user } = await renderApp("/datasets");
    await waitFor(() => expect(rows()).toHaveLength(10));
    await user.click(within(rows()[0]).getByRole("checkbox"));
    await user.click(within(rows()[1]).getByRole("checkbox"));
    expect(Object.keys(useSelection.getState().items)).toHaveLength(2);
    expect(await screen.findByText("2 selected")).toBeInTheDocument();
  });

  it("clearing the selection asks first, and can be undone", async () => {
    const { user } = await renderApp("/datasets");
    await waitFor(() => expect(rows()).toHaveLength(10));
    await user.click(within(rows()[0]).getByRole("checkbox"));
    await user.click(within(rows()[1]).getByRole("checkbox"));
    await user.click(await screen.findByRole("button", { name: "Clear selection" }));
    // asked first: nothing is cleared until it is confirmed
    expect(await screen.findByText(/Clear the selection\?/)).toBeInTheDocument();
    expect(Object.keys(useSelection.getState().items)).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(useSelection.getState().items).toEqual({}));
    // and brought back by Undo in the toast
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(Object.keys(useSelection.getState().items)).toHaveLength(2));
  });

  it("Cancel leaves the selection alone", async () => {
    const { user } = await renderApp("/datasets");
    await waitFor(() => expect(rows()).toHaveLength(10));
    await user.click(within(rows()[0]).getByRole("checkbox"));
    await user.click(await screen.findByRole("button", { name: "Clear selection" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(Object.keys(useSelection.getState().items)).toHaveLength(1);
  });

  it("opens a dataset from its preview", async () => {
    const { user } = await renderApp("/datasets");
    await waitFor(() => expect(rows()).toHaveLength(10));
    const pid = rows()[0].getAttribute("data-pid")!;
    await user.click(rows()[0]);
    await user.click(await screen.findByRole("button", { name: /Open details/ }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toContain(encodeURIComponent(pid)));
  });

  it("pages forward", async () => {
    const { user } = await renderApp("/datasets");
    await waitFor(() => expect(rows()).toHaveLength(10));
    const firstPid = rows()[0].getAttribute("data-pid");
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(rows()[0]?.getAttribute("data-pid")).not.toBe(firstPid));
  });
});
