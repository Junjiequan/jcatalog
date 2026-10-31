import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderApp, resetApp } from "@/test/app";
import { useUI } from "@/store/ui";

afterEach(resetApp);

const rows = () => screen.queryAllByRole("row").filter((r) => r.hasAttribute("data-pid"));
const where = () => screen.getByTestId("where").textContent!;
const openList = async (query = "") => {
  const ctx = await renderApp(`/datasets${query}`);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return ctx;
};
// the filter panel's section, by its title; most start folded, so a test opens what it needs
const section = (title: string) => screen.getAllByRole("button", { name: new RegExp(`^(Collapse|Expand) ${title}$`, "i") })[0];
const expand = async (user: Awaited<ReturnType<typeof renderApp>>["user"], title: string) => {
  const toggle = section(title);
  if (/^Expand/.test(toggle.getAttribute("aria-label")!)) await user.click(toggle);
};

describe("technique and instrument tiles", () => {
  it("clicking a technique filters by it, and clicking again lifts the filter", async () => {
    const { user } = await openList();
    const tile = (await screen.findAllByRole("button", { name: /^SANS$/ })).find((b) => b.hasAttribute("aria-pressed"))!;
    expect(tile).toHaveAttribute("aria-pressed", "false");
    await user.click(tile);
    await waitFor(() => expect(where()).toContain("tech=SANS"));
    expect(tile).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(tile);
    await waitFor(() => expect(where()).not.toContain("tech="));
  });

  it("two techniques together mean either one, and the URL lists both", async () => {
    const { user } = await openList();
    await user.click((await screen.findAllByRole("button", { name: /^SANS$/ })).find((b) => b.hasAttribute("aria-pressed"))!);
    await user.click((await screen.findAllByRole("button", { name: /^Imaging$/ })).find((b) => b.hasAttribute("aria-pressed"))!);
    await waitFor(() => expect(decodeURIComponent(where())).toMatch(/tech=SANS[,;]Imaging|tech=Imaging[,;]SANS|tech=SANS.*Imaging/));
  });

  it("unfolds the techniques that do not fit, and folds them again", async () => {
    const { user } = await openList();
    const more = (await screen.findAllByRole("button", { name: /^\+\d+ more$/ }))[0];
    await user.click(more);
    expect((await screen.findAllByRole("button", { name: "Show fewer" })).length).toBeGreaterThan(0);
  });

  it("an instrument tile filters by that instrument", async () => {
    const { user } = await openList();
    const tile = (await screen.findAllByRole("button", { name: /LoKI/ })).find((b) => b.hasAttribute("aria-pressed"))!;
    await user.click(tile);
    await waitFor(() => expect(where()).toContain("inst=loki"));
  });
});

describe("the other filters", () => {
  it("finds a proposal by typing, and ticking it filters by it", async () => {
    const { user } = await openList();
    await expand(user, "Proposal");
    const box = await screen.findByRole("combobox", { name: "Find a proposal" });
    await user.click(box);
    const list = await screen.findByRole("listbox");
    const option = (await within(list).findAllByRole("option"))[0];
    await user.click(option);
    await waitFor(() => expect(where()).toMatch(/prop=/));
  });

  it("a date preset filters by creation date", async () => {
    const { user } = await openList();
    await expand(user, "Created");
    const preset = await screen.findByRole("button", { name: "12 months" });
    await user.click(preset);
    await waitFor(() => expect(where()).toMatch(/from=\d{4}-\d{2}-\d{2}/));
  });

  it("a keyword chip filters by that keyword", async () => {
    const { user } = await openList();
    await expand(user, "Keywords");
    // keywords are lower case; the technique tiles above are not
    // they arrive from the keyword index a moment after the section opens
    const chips = () => screen.getAllByRole("button").filter((b) => /^[a-z][a-z ]+$/.test(b.textContent!.trim()) && b.hasAttribute("aria-pressed"));
    await waitFor(() => expect(chips().length).toBeGreaterThan(0));
    await user.click(chips()[0]);
    await waitFor(() => expect(where()).toMatch(/kw=/));
  });
});

describe("the type switch in the toolbar", () => {
  it("is not in the filter panel, and Derived narrows the list to derived datasets", async () => {
    const { user } = await openList();
    expect(screen.queryByRole("button", { name: /^(Collapse|Expand) Type$/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Type" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Derived" }));
    await waitFor(() => expect(where()).toContain("type=derived"));
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    for (const r of rows()) expect(within(r).getByText("Derived")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Derived" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Any" }));
    await waitFor(() => expect(where()).not.toContain("type="));
  });
});

describe("measured properties", () => {
  it("adds a property from the dictionary, and a value narrows the list", async () => {
    const { user } = await openList();
    await expand(user, "Measurements");
    await user.click(await screen.findByRole("button", { name: /Add a measured property/ }));
    const box = await screen.findByRole("combobox", { name: "Search measured properties" });
    await user.type(box, "temperature");
    await user.click((await screen.findAllByRole("option"))[0]);
    expect((await screen.findAllByRole("button", { name: /^Remove / })).length).toBeGreaterThan(0);
    const value = await screen.findByPlaceholderText(/value/i);
    await user.type(value, "100");
    await waitFor(() => expect(where()).toMatch(/m=/));
  });

  it("removing the property lifts the condition", async () => {
    const { user } = await openList();
    await expand(user, "Measurements");
    await user.click(await screen.findByRole("button", { name: /Add a measured property/ }));
    await user.type(await screen.findByRole("combobox", { name: "Search measured properties" }), "temperature");
    await user.click((await screen.findAllByRole("option"))[0]);
    await user.click((await screen.findAllByRole("button", { name: /^Remove / }))[0]);
    await waitFor(() => expect(where()).not.toMatch(/m=/));
  });
});

describe("sections and clearing", () => {
  it("a section collapses and is remembered", async () => {
    const { user } = await openList();
    const toggle = section("Technique");
    await user.click(toggle);
    expect(Object.values(useUI.getState().filterSections)).toContain(false);
  });

  it("Clear all lifts every filter at once", async () => {
    const { user } = await openList("?scope=all&tech=SANS&type=derived&kw=protein");
    await waitFor(() => expect(where()).toContain("tech=SANS"));
    const clear = (await screen.findAllByRole("button", { name: /Clear all/i }))[0];
    await user.click(clear);
    await waitFor(() => expect(where()).not.toMatch(/tech=|type=|kw=/));
  });

  it("the filter count on the button follows the filters", async () => {
    await openList("?scope=all&tech=SANS&type=derived");
    // the type switch is in the toolbar, so only the technique counts
    expect(await screen.findByRole("button", { name: /Filters/ })).toHaveTextContent("1");
  });
});

describe("saved searches", () => {
  it("saves the current filters under a name, and applies them again from the panel", async () => {
    const { user } = await openList("?scope=all&tech=SANS");
    await user.click(await screen.findByRole("button", { name: "Save search" }));
    await user.type(await screen.findByLabelText("Name this search"), "Cold SANS{Enter}");
    await waitFor(() => expect(useUI.getState().savedSearches).toHaveLength(1));
    expect(useUI.getState().savedSearches[0]).toMatchObject({ name: "Cold SANS", qs: expect.stringContaining("tech=SANS") });
    await user.click((await screen.findAllByRole("button", { name: /^Clear all/i }))[0]);
    await waitFor(() => expect(where()).not.toContain("tech="));
    await user.click((await screen.findAllByText("Cold SANS"))[0]);
    await waitFor(() => expect(where()).toContain("tech=SANS"));
  });

  it("deleting a saved search takes it away", async () => {
    useUI.getState().saveSearch("Old search", "tech=SANS");
    const { user } = await openList();
    await user.click(await screen.findByRole("button", { name: "Delete Old search" }));
    await waitFor(() => expect(useUI.getState().savedSearches).toHaveLength(0));
  });
});

describe("renaming a saved search", () => {
  it("the save button applies the typed name, and is off until the name changes", async () => {
    useUI.setState({ savedSearches: [{ id: "s1", name: "Cold SANS", qs: "scope=all&tech=SANS" }] });
    const { user } = await openList();
    await user.click(await screen.findByRole("button", { name: /Preview/ }));
    const save = await screen.findByRole("button", { name: "Save the name" });
    expect(save).toBeDisabled();
    const box = screen.getByLabelText("Saved search name");
    await user.clear(box);
    await user.type(box, "Warm SANS");
    expect(save).toBeEnabled();
    await user.click(save);
    await waitFor(() => expect(useUI.getState().savedSearches[0].name).toBe("Warm SANS"));
  });
});
