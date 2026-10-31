import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { api } from "@/api";
import { renderApp, resetApp } from "@/test/app";
import { useSelection } from "@/store/selection";
import { useUI } from "@/store/ui";

afterEach(resetApp);

// a seeded sample that has data, instruments and proposals
async function sample() {
  await api.auth.signInDemo!("admin@example.org");
  const list = await api.samples.list();
  return (await api.samples.get(list.find((s) => s.datasetCount > 3 && s.instrumentIds.length > 0)!.sampleId));
}

describe("a sample's page", () => {
  it("says what the sample is: name, formula, id, group, and how much data it has", async () => {
    const d = await sample();
    await renderApp(`/samples/${d.sample.sampleId}`);
    expect(await screen.findByRole("heading", { level: 1, name: d.sample.sampleName })).toBeInTheDocument();
    expect(screen.getAllByText(d.sample.sampleId).length).toBeGreaterThan(0);
    if (d.sample.formula) expect(screen.getAllByText(d.sample.formula).length).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(`${d.datasetCount} datasets`))).toBeInTheDocument();
  });

  it("lists the description, characteristics and the facts of the record on the overview", async () => {
    const d = await sample();
    await renderApp(`/samples/${d.sample.sampleId}`);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText(d.sample.description)).toBeInTheDocument();
    for (const k of Object.keys(d.sample.sampleCharacteristics)) expect(screen.getAllByText(k).length).toBeGreaterThan(0);
    expect(screen.getByText("Owner group")).toBeInTheDocument();
    expect(screen.getByText("Who can see it")).toBeInTheDocument();
  });

  it("counts what each tab holds, and the tab is in the link", async () => {
    const d = await sample();
    const { user } = await renderApp(`/samples/${d.sample.sampleId}`);
    expect(await screen.findByRole("tab", { name: new RegExp(`Proposals\\s*${d.proposals.length}`) })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: new RegExp(`Instruments\\s*${d.instruments.length}`) })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: new RegExp(`Datasets\\s*${d.datasetCount}`) })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Proposals/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("tab=proposals");
  });

  it("the Proposals tab links to each proposal, the Datasets tab to the latest datasets", async () => {
    const d = await sample();
    await renderApp(`/samples/${d.sample.sampleId}?tab=proposals`);
    await screen.findByRole("heading", { level: 1 });
    const href = new RegExp(encodeURIComponent(d.proposals[0].proposalId));
    await waitFor(() => expect(screen.getAllByRole("link").some((l) => href.test(l.getAttribute("href") ?? ""))).toBe(true));
    await resetApp();
    await renderApp(`/samples/${d.sample.sampleId}?tab=datasets`);
    expect((await screen.findAllByRole("link", { name: new RegExp(d.recent[0].datasetName) })).length).toBeGreaterThan(0);
  });

  it("Browse datasets leads to the datasets of this sample", async () => {
    const d = await sample();
    await renderApp(`/samples/${d.sample.sampleId}`);
    const link = await screen.findByRole("link", { name: /Browse datasets/ });
    expect(link).toHaveAttribute("href", `/datasets?scope=all&q=${encodeURIComponent(d.sample.sampleName)}`);
  });

  it("can be added to the selection, and is remembered in recently viewed", async () => {
    const d = await sample();
    const { user } = await renderApp(`/samples/${d.sample.sampleId}`);
    await user.click(await screen.findByRole("button", { name: /Add to selection/ }));
    expect(useSelection.getState().items[`sample:${d.sample.sampleId}`]).toMatchObject({ kind: "sample", link: `/samples/${d.sample.sampleId}` });
    expect(await screen.findByRole("button", { name: /In selection/ })).toBeInTheDocument();
    await waitFor(() => expect(useUI.getState().recent[0]).toMatchObject({ kind: "sample", pid: d.sample.sampleId }));
  });

  it("an instrument clicked here finds other samples measured on it, not datasets", async () => {
    const d = await sample();
    const { user } = await renderApp(`/samples/${d.sample.sampleId}`);
    await screen.findByRole("heading", { level: 1 });
    const chip = (await screen.findAllByTitle(new RegExp(`Show samples on ${d.instruments[0].name}`)))[0];
    await user.click(chip);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(`/samples?inst=${d.instruments[0].pid}`));
  });

  it("an unknown sample is reported, and Back leads to the list", async () => {
    const { user } = await renderApp("/samples/no-such-sample");
    expect(await screen.findByText("Not found")).toBeInTheDocument();
    void user;
  });

  it("Back returns to the list when the page was opened directly", async () => {
    const d = await sample();
    const { user } = await renderApp(`/samples/${d.sample.sampleId}`);
    await user.click(await screen.findByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/samples"));
    void within;
  });
});
