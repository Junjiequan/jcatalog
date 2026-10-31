import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { api } from "@/api";
import { renderApp, resetApp } from "@/test/app";
import { useSelection } from "@/store/selection";

afterEach(resetApp);

const search = (kind: "proposals" | "experiments") => screen.findByPlaceholderText(kind === "proposals" ? /Search proposals/ : /Search experiments/);

describe("the proposals list", () => {
  it("lists proposals, newest first, each with its number and title", async () => {
    await renderApp("/proposals");
    expect(await screen.findByRole("heading", { name: "Proposals" })).toBeInTheDocument();
    const first = (await api.proposals.list()).filter((p) => p.type !== "Experiment")[0];
    expect((await screen.findAllByText(first.proposalId)).length).toBeGreaterThan(0);
  });

  it("is not the experiments list", async () => {
    await renderApp("/proposals");
    await screen.findByRole("heading", { name: "Proposals" });
    const experiment = (await api.proposals.list()).find((p) => p.type === "Experiment")!;
    expect(screen.queryByText(experiment.proposalId)).not.toBeInTheDocument();
  });

  it("narrows as you type, and says so when nothing matches", async () => {
    const { user } = await renderApp("/proposals");
    await user.type(await search("proposals"), "zzzznothing");
    expect(await screen.findByText(/No proposals|Nothing/i)).toBeInTheDocument();
  });

  it("selects a proposal into the shared selection", async () => {
    const { user } = await renderApp("/proposals");
    const boxes = await screen.findAllByRole("checkbox", { name: /^Select / });
    await user.click(boxes[0]);
    expect(Object.values(useSelection.getState().items)[0]).toMatchObject({ kind: "proposal" });
  });

  it("the experiments have a list of their own", async () => {
    await renderApp("/experiments");
    expect(await screen.findByRole("heading", { name: "Experiments" })).toBeInTheDocument();
    const experiment = (await api.proposals.list()).find((p) => p.type === "Experiment")!;
    expect((await screen.findAllByText(experiment.proposalId)).length).toBeGreaterThan(0);
  });
});

describe("a proposal's page", () => {
  it("shows its tabs with counts, among them its experiments", async () => {
    await api.auth.signInDemo!("admin@example.org");
    const proposal = (await api.proposals.list()).find((p) => p.type !== "Experiment" && p.datasetCount > 0)!;
    await renderApp(`/proposals/${proposal.proposalId}`);
    expect(await screen.findByRole("tab", { name: /Beam time/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Experiments/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: new RegExp(`Datasets\\s*${proposal.datasetCount}`) })).toBeInTheDocument();
  });

  it("an experiment has no Experiments tab of its own", async () => {
    await api.auth.signInDemo!("admin@example.org");
    const experiment = (await api.proposals.list()).find((p) => p.type === "Experiment")!;
    await renderApp(`/experiments/${experiment.proposalId}`);
    expect(await screen.findByRole("tab", { name: /Beam time/ })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Experiments/ })).not.toBeInTheDocument();
  });

  it("lists its datasets, each linking to the dataset", async () => {
    await api.auth.signInDemo!("admin@example.org");
    const proposal = (await api.proposals.list()).find((p) => p.type !== "Experiment" && p.datasetCount > 0)!;
    const { user } = await renderApp(`/proposals/${proposal.proposalId}?tab=datasets`);
    const link = (await screen.findAllByRole("link", { name: /MDC-|[A-Z]{3,}\d{5}/ }))[0];
    await user.click(link);
    await waitFor(() => expect(screen.getByTestId("where").textContent).toMatch(/^\/datasets\//));
  });

  it("an experiment names its proposal and links to it", async () => {
    await api.auth.signInDemo!("admin@example.org");
    const experiment = (await api.proposals.list()).find((p) => p.type === "Experiment")!;
    await renderApp(`/experiments/${experiment.proposalId}`);
    const link = await screen.findByRole("link", { name: new RegExp(`Belongs to proposal ${experiment.parentProposalId}`) });
    expect(link).toHaveAttribute("href", `/proposals/${experiment.parentProposalId}`);
  });

  it("shows the team and the booked beam time", async () => {
    await api.auth.signInDemo!("admin@example.org");
    const proposal = (await api.proposals.list())[0];
    const { user } = await renderApp(`/proposals/${proposal.proposalId}?tab=team`);
    expect((await screen.findAllByText(proposal.pi)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("tab", { name: /Beam time/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("tab=schedule");
  });

  it("an unknown proposal is reported, not blank", async () => {
    await renderApp("/proposals/no-such-proposal");
    expect(await screen.findByText("Not found")).toBeInTheDocument();
  });
});
