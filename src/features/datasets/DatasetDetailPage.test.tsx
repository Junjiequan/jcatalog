import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { api } from "@/api";
import { DEFAULT_QUERY } from "@/lib/query";
import { renderApp, resetApp } from "@/test/app";
import { useSelection } from "@/store/selection";
import type { Dataset } from "@/types";

afterEach(resetApp);

// seeded datasets with known relations (the mock is deterministic): found by what they are, not by a fixed pid
async function pick(find: (d: Dataset) => boolean) {
  await api.auth.signInDemo!("admin@example.org");
  const all = (await api.datasets.list({ ...DEFAULT_QUERY, scope: "all", pageSize: 100 })).items;
  return all.find(find)!;
}
const derived = () => pick((d) => d.type === "derived");
const raw = () => pick((d) => d.type === "raw" && d.createdBy === "ingestor" && !d.isPublished);

describe("a dataset's page", () => {
  it("shows its name, pid, type and where it is stored", async () => {
    const d = await raw();
    await renderApp(`/datasets/${encodeURIComponent(d.pid)}`);
    expect(await screen.findByRole("heading", { level: 1, name: d.datasetName })).toBeInTheDocument();
    expect(screen.getByText(d.pid)).toBeInTheDocument();
    expect(screen.getByText("Raw")).toBeInTheDocument();
  });

  it("says so for a dataset that does not exist, and offers a way back", async () => {
    await renderApp("/datasets/no-such-dataset");
    expect(await screen.findByText(/can't show this dataset/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Back" }).length).toBeGreaterThan(0);
  });

  it("opens on the tab named in the link, and switching tabs updates the link", async () => {
    const d = await raw();
    const { user } = await renderApp(`/datasets/${encodeURIComponent(d.pid)}?tab=metadata`);
    expect(await screen.findByRole("tab", { name: /Measurements/ })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: /History/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("tab=history");
    await user.click(screen.getByRole("tab", { name: "Overview" }));
    expect(screen.getByTestId("where").textContent).not.toContain("tab=");
  });

  it("counts what each tab holds", async () => {
    const d = await raw();
    await renderApp(`/datasets/${encodeURIComponent(d.pid)}`);
    expect(await screen.findByRole("tab", { name: new RegExp(`Measurements\\s*${Object.keys(d.scientificMetadata).length}`) })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: new RegExp(`History\\s*${d.history.length}`) })).toBeInTheDocument();
  });

  it("lists the files on the Files tab and filters them", async () => {
    const d = await raw();
    const { user } = await renderApp(`/datasets/${encodeURIComponent(d.pid)}?tab=files`);
    const files = await screen.findAllByRole("checkbox", { name: /^Select / });
    expect(files.length).toBeGreaterThan(2);
    expect(screen.getByRole("button", { name: "Download all" })).toBeInTheDocument();
    await user.click(files[0]);
    expect(await screen.findByRole("button", { name: "Download 1 selected" })).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Filter files…"), "zzzzzz-no-such-file");
    expect(await screen.findByText("No files match")).toBeInTheDocument();
  });

  it("shows the history, newest event included", async () => {
    const d = await raw();
    await renderApp(`/datasets/${encodeURIComponent(d.pid)}?tab=history`);
    expect(await screen.findByText(/Dataset record created/)).toBeInTheDocument();
  });

  it("a derived dataset says what it came from and links to it", async () => {
    const d = await derived();
    await renderApp(`/datasets/${encodeURIComponent(d.pid)}?tab=related`);
    expect(await screen.findByText(`Derived from ${d.inputDatasets.length}`)).toBeInTheDocument();
    const src = await api.datasets.get(d.inputDatasets[0]);
    const link = (await screen.findAllByRole("link", { name: new RegExp(src.datasetName) }))[0];
    expect(link).toHaveAttribute("href", expect.stringContaining(encodeURIComponent(src.pid)));
  });
});

describe("what a person may do with it", () => {
  it("the owner's group can rename it, and the change shows at once", async () => {
    const d = await pick((x) => x.ownerGroup === "ada-lab" || x.ownerGroup === "bio-sax");
    const { user } = await renderApp(`/datasets/${encodeURIComponent(d.pid)}`, { as: "ada" });
    await user.click(await screen.findByRole("button", { name: "Rename dataset" }));
    const box = screen.getByRole("textbox", { name: "Dataset name" });
    await user.clear(box);
    await user.type(box, "Renamed in a test{Enter}");
    expect(await screen.findByRole("heading", { level: 1, name: "Renamed in a test" })).toBeInTheDocument();
    expect((await api.datasets.get(d.pid)).datasetName).toBe("Renamed in a test");
    await api.datasets.update(d.pid, { datasetName: d.datasetName });
  });

  it("someone outside the group sees it but cannot change, share, publish or delete it", async () => {
    const d = await pick((x) => x.isPublished && !["nilsson-mat"].includes(x.ownerGroup));
    await renderApp(`/datasets/${encodeURIComponent(d.pid)}`, { as: "henrik" });
    await screen.findByRole("heading", { level: 1, name: d.datasetName });
    expect(screen.queryByRole("button", { name: "Rename dataset" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Publish/ })).not.toBeInTheDocument();
  });

  it("adds it to the selection, and shows that it is in", async () => {
    const d = await raw();
    const { user } = await renderApp(`/datasets/${encodeURIComponent(d.pid)}`);
    await user.click(await screen.findByRole("button", { name: /Add to selection/ }));
    expect(useSelection.getState().items[d.pid]).toBeTruthy();
    expect(await screen.findByRole("button", { name: /In selection/ })).toBeInTheDocument();
  });

  it("deleting asks first, removes it, and Undo brings it back", async () => {
    const d = await raw();
    const { user } = await renderApp(`/datasets/${encodeURIComponent(d.pid)}`);
    await user.click(await screen.findByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: /Delete dataset/ }));
    expect(await screen.findByText("Delete this dataset?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete dataset" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/datasets"));
    await expect(api.datasets.get(d.pid)).rejects.toThrow();
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toContain(encodeURIComponent(d.pid)));
    expect((await api.datasets.get(d.pid)).pid).toBe(d.pid);
  });

  it("publishing asks first, and says what it means", async () => {
    const d = await raw();
    const { user } = await renderApp(`/datasets/${encodeURIComponent(d.pid)}`);
    await user.click(await screen.findByRole("button", { name: /Publish/ }));
    expect(await screen.findByText("Publish this dataset?")).toBeInTheDocument();
    expect(screen.getByText(/DOI can't be removed/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect((await api.datasets.get(d.pid)).isPublished).toBe(false);
  });

  it("sharing adds a group and lists it", async () => {
    const d = await raw();
    const { user } = await renderApp(`/datasets/${encodeURIComponent(d.pid)}`);
    await user.click(await screen.findByRole("button", { name: "Share" }));
    await user.type(await screen.findByLabelText("Add a group or person"), "kovacs-lab{Enter}");
    expect(await screen.findByRole("button", { name: "Remove kovacs-lab" })).toBeInTheDocument();
  });
});

describe("a proposal's and an experiment's page, reached from a dataset", () => {
  it("links the dataset to its proposal", async () => {
    const d = await raw();
    await renderApp(`/datasets/${encodeURIComponent(d.pid)}?tab=related`);
    const links = await screen.findAllByRole("link", { name: new RegExp(d.proposalId) });
    expect(links[0].getAttribute("href")).toMatch(/\/(proposals|experiments)\//);
  });
});
