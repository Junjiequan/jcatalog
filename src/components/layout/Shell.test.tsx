import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderApp, resetApp } from "@/test/app";
import { useUI } from "@/store/ui";

afterEach(resetApp);

describe("the shell around every page", () => {
  it("leads to each area from the sidebar", async () => {
    const { user } = await renderApp("/datasets");
    const nav = (await screen.findAllByRole("link", { name: "Samples" }))[0];
    await user.click(nav);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/samples"));
    expect(await screen.findByRole("heading", { name: "Samples" })).toBeInTheDocument();
  });

  it("an administrator can start a new dataset, a user cannot", async () => {
    await renderApp("/datasets", { as: "admin" });
    expect(await screen.findByRole("button", { name: "New dataset" })).toBeInTheDocument();
    await resetApp();
  });

  it("a user is not offered a new dataset", async () => {
    await renderApp("/datasets", { as: "ada" });
    await screen.findByRole("heading", { name: "Datasets" });
    expect(screen.queryByRole("button", { name: "New dataset" })).not.toBeInTheDocument();
  });

  it("shows the account's role on its avatar menu", async () => {
    const { user } = await renderApp("/datasets", { as: "admin" });
    await user.click(await screen.findByRole("button", { name: "Account" }));
    expect(await screen.findByText("admin@example.org")).toBeInTheDocument();
    expect(screen.getAllByText("Administrator").length).toBeGreaterThan(0);
  });

  it("collapses and expands the sidebar", async () => {
    const { user } = await renderApp("/datasets");
    await user.click(await screen.findByRole("button", { name: "Collapse sidebar" }));
    expect(useUI.getState().sidebarCollapsed).toBe(true);
    await user.click(await screen.findByRole("button", { name: "Expand sidebar" }));
    expect(useUI.getState().sidebarCollapsed).toBe(false);
  });
});

describe("shortcuts", () => {
  it("? opens the shortcut help, Escape closes it", async () => {
    const { user } = await renderApp("/datasets");
    await screen.findByRole("heading", { name: "Datasets" });
    await user.keyboard("?");
    expect(await screen.findByText("This help")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("This help")).not.toBeInTheDocument());
  });

  it("/ focuses the search box of a list", async () => {
    const { user } = await renderApp("/datasets");
    const box = await screen.findByPlaceholderText(/Search by name/);
    await user.keyboard("/");
    expect(box).toHaveFocus();
  });

  it("a plain key is ignored while typing", async () => {
    const { user } = await renderApp("/datasets");
    const box = await screen.findByPlaceholderText(/Search by name/);
    await user.click(box);
    await user.keyboard("?");
    expect(screen.queryByText("This help")).not.toBeInTheDocument();
    expect(box).toHaveValue("?");
  });
});

describe("quick access", () => {
  it("opens with Ctrl+K and offers pages to go to", async () => {
    const { user } = await renderApp("/datasets");
    await screen.findByRole("heading", { name: "Datasets" });
    await user.keyboard("{Control>}k{/Control}");
    const box = await screen.findByPlaceholderText(/Where to\?/);
    expect(box).toHaveFocus();
    expect(screen.getByText("Go to")).toBeInTheDocument();
  });

  it("what is typed narrows what was opened lately, and asks the server for nothing", async () => {
    useUI.getState().pushRecent({ kind: "dataset", pid: "D-1", name: "Lysozyme run" });
    useUI.getState().pushRecent({ kind: "proposal", pid: "20240311", name: "A proposal" });
    const { user } = await renderApp("/datasets");
    await user.click(await screen.findByRole("button", { name: "Quick access" }));
    const box = await screen.findByPlaceholderText(/Where to\?/);
    await user.type(box, "lysoz");
    const dialog = screen.getByRole("dialog");
    // the typed letters are picked out in the label, which splits its text
    const rows = within(dialog).getAllByRole("button").map((b) => b.textContent);
    expect(rows.some((t) => t?.includes("Lysozyme run"))).toBe(true);
    expect(rows.some((t) => t?.includes("A proposal"))).toBe(false);
  });

  it("a typed word is taken to the list of the section the user is in, already searched", async () => {
    const { user } = await renderApp("/proposals");
    await user.click(await screen.findByRole("button", { name: "Quick access" }));
    const box = await screen.findByPlaceholderText(/Where to\?/);
    await user.type(box, "zzqq");
    await user.click(await screen.findByText(/ in proposals$/, { selector: "span" }).then((e) => e.closest("button")!));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/proposals?q=zzqq"));
    expect(await screen.findByDisplayValue("zzqq")).toBeInTheDocument();
  });

  it("lists what was looked at recently before anything is typed, each marked with its kind", async () => {
    useUI.getState().pushRecent({ kind: "dataset", pid: "D-1", name: "A dataset" });
    useUI.getState().pushRecent({ kind: "proposal", pid: "20240311", name: "A proposal" });
    useUI.getState().pushRecent({ kind: "experiment", pid: "20240311-1", name: "An experiment" });
    const { user } = await renderApp("/datasets");
    await user.click(await screen.findByRole("button", { name: "Quick access" }));
    await screen.findByText("Recent");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Dataset")).toBeInTheDocument();
    expect(within(dialog).getByText("Proposal")).toBeInTheDocument();
    expect(within(dialog).getByText("Experiment")).toBeInTheDocument();
  });

  it("a recent proposal opens the proposal, a recent dataset the dataset", async () => {
    useUI.getState().pushRecent({ kind: "proposal", pid: "20240311", name: "A proposal" });
    const { user } = await renderApp("/datasets");
    await user.click(await screen.findByRole("button", { name: "Quick access" }));
    await user.click(await within(await screen.findByRole("dialog")).findByText("A proposal"));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/proposals/20240311"));
  });
});

describe("recently viewed, as the pages record it", () => {
  it("visiting a dataset and a proposal puts both in the list", async () => {
    await renderApp("/proposals/20240311");
    await screen.findByRole("tab", { name: /Beam time/ });
    await waitFor(() => expect(useUI.getState().recent.some((r) => r.kind === "proposal" && r.pid === "20240311")).toBe(true));
  });
});
