import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderApp, resetApp } from "@/test/app";
import { useAuth } from "@/store/auth";
import { useUI } from "@/store/ui";

afterEach(resetApp);

// the settings row with this title: the nearest ancestor of the title that holds its choice
const rowOf = (title: string) => {
  let el: HTMLElement | null = screen.getByText(title);
  while (el && !within(el).queryByRole("tablist")) el = el.parentElement;
  return within(el!);
};

describe("settings", () => {
  it("shows who is signed in, and says an administrator is one", async () => {
    await renderApp("/settings", { as: "admin" });
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getAllByText("Facility Administrator").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Administrator").length).toBeGreaterThan(0);
    expect(screen.getByText(/You are an administrator/)).toBeInTheDocument();
  });

  it("a user sees their groups and no administrator note", async () => {
    await renderApp("/settings", { as: "ada" });
    expect(await screen.findByText("ada-lab")).toBeInTheDocument();
    expect(screen.getByText("bio-sax")).toBeInTheDocument();
    expect(screen.queryByText(/You are an administrator/)).not.toBeInTheDocument();
  });

  it("opens on the tab named in the link", async () => {
    await renderApp("/settings?tab=preferences");
    expect(await screen.findByRole("tab", { name: "Preferences" })).toHaveAttribute("aria-selected", "true");
  });

  it("the API token is hidden until shown, and a new one asks first", async () => {
    const { user } = await renderApp("/settings");
    expect(await screen.findByText(/^•+$/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show token" }));
    expect(screen.queryByText(/^•+$/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Regenerate/ }));
    expect(await screen.findByText("Generate a new token?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
  });

  it("changes the theme and remembers it", async () => {
    const { user } = await renderApp("/settings?tab=preferences");
    await screen.findByText("Theme");
    await user.click(rowOf("Theme").getByRole("tab", { name: "Dark" }));
    expect(useUI.getState().theme).toBe("dark");
    expect(JSON.parse(localStorage.getItem("metadatacatalogue.ui")!).state.theme).toBe("dark");
  });

  it("switches every list to compact rows", async () => {
    const { user } = await renderApp("/settings?tab=preferences");
    await screen.findByText("Compact rows");
    await user.click(rowOf("Compact rows").getByRole("tab", { name: "On" }));
    expect(useUI.getState().density).toBe("compact");
  });

  it("clears recently viewed", async () => {
    useUI.getState().pushRecent({ kind: "dataset", pid: "X", name: "x" });
    const { user } = await renderApp("/settings?tab=preferences");
    expect(await screen.findByText("1 item offered in search before you type")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(useUI.getState().recent).toEqual([]);
  });

  it("Back returns to where you were, or to the datasets", async () => {
    const { user } = await renderApp("/settings");
    await user.click(await screen.findByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/datasets"));
  });
});

describe("saved searches", () => {
  it("lists them, renames one, and deletes it after asking", async () => {
    useUI.getState().saveSearch("Cold runs", "tech=SANS");
    const { user } = await renderApp("/settings?tab=saved");
    await user.click(await screen.findByTitle("Click to rename"));
    const box = screen.getByRole("textbox");
    await user.clear(box);
    await user.type(box, "Warm runs{Enter}");
    expect(await screen.findByText("Warm runs")).toBeInTheDocument();
    expect(useUI.getState().savedSearches[0].name).toBe("Warm runs");
  });

  it("says when there are none", async () => {
    await renderApp("/settings?tab=saved");
    expect(await screen.findByText("Save a search from the Datasets page and it shows up here.")).toBeInTheDocument();
  });
});

describe("signing out", () => {
  it("from the account menu: back to the login page, and the session is gone", async () => {
    const { user } = await renderApp("/datasets");
    await user.click(await screen.findByRole("button", { name: "Account" }));
    await user.click(await screen.findByRole("menuitem", { name: /Sign out/ }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/login"));
    expect(useAuth.getState().session).toBeNull();
  });
});
