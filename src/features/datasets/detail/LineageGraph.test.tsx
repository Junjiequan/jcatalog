import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { api } from "@/api";
import { DEFAULT_QUERY } from "@/lib/query";
import { renderApp, resetApp } from "@/test/app";
import type { Dataset } from "@/types";

afterEach(resetApp);

// the seeded raw dataset with the most datasets derived from it, and one of those
async function family() {
  await api.auth.signInDemo!("admin@example.org");
  const all = (await api.datasets.list({ ...DEFAULT_QUERY, scope: "all", pageSize: 100 })).items;
  const kids = new Map<string, Dataset[]>();
  for (const d of all) for (const src of d.inputDatasets) kids.set(src, [...(kids.get(src) ?? []), d]);
  const [parentPid, derived] = [...kids].sort((a, b) => b[1].length - a[1].length)[0];
  return { parent: all.find((d) => d.pid === parentPid)!, derived };
}
const open = (d: Dataset) => renderApp(`/datasets/${encodeURIComponent(d.pid)}?tab=related`);

describe("the lineage graph", () => {
  it("draws the dataset with everything made from it", async () => {
    const { parent, derived } = await family();
    await open(parent);
    await screen.findByText("This dataset");
    for (const d of derived) expect((await screen.findAllByText(d.datasetName)).length).toBeGreaterThan(0);
  });

  it("puts the proposal's name on the box the datasets sit in", async () => {
    const { parent } = await family();
    await open(parent);
    const links = await screen.findAllByRole("link", { name: new RegExp(parent.proposalId) });
    expect(links.some((l) => /^\/(proposals|experiments)\//.test(l.getAttribute("href")!))).toBe(true);
  });

  it("clicking another dataset of the graph opens it, on its own Related tab", async () => {
    const { parent, derived } = await family();
    await open(parent);
    // the card in the graph, not the list of the same datasets below it. A plain click: the pan-and-zoom layer's
    // mouse handling needs a real browser window, which happy-dom does not have
    await screen.findByText("This dataset");
    const graph = document.querySelector<HTMLElement>(".react-flow")!;
    fireEvent.click(await within(graph).findByText(derived[0].datasetName));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe(`/datasets/${encodeURIComponent(derived[0].pid)}?tab=related`));
  });

  it("a dataset with no relations says there is no lineage yet", async () => {
    await api.auth.signInDemo!("admin@example.org");
    const all = (await api.datasets.list({ ...DEFAULT_QUERY, scope: "all", pageSize: 100 })).items;
    const used = new Set(all.flatMap((d) => d.inputDatasets));
    const alone = all.find((d) => d.type === "raw" && !used.has(d.pid))!;
    await open(alone);
    expect(await screen.findByText("No lineage yet")).toBeInTheDocument();
    expect(screen.getByText(/raw data, and nothing has been derived/)).toBeInTheDocument();
  });

  it("can be opened large, and closed again", async () => {
    const { parent } = await family();
    const { user } = await open(parent);
    await screen.findByText("This dataset");
    await user.click(screen.getByRole("button", { name: "Expand" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByText(parent.datasetName).length).toBeGreaterThan(0);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
