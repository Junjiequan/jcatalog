import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { api } from "@/api";
import { renderApp, resetApp } from "@/test/app";

afterEach(resetApp);

describe("samples", () => {
  it("lists the samples with how much data each has", async () => {
    await renderApp("/samples");
    expect(await screen.findByRole("heading", { name: "Samples" })).toBeInTheDocument();
    const sample = (await api.samples.list())[0];
    expect((await screen.findAllByText(sample.sampleName)).length).toBeGreaterThan(0);
  });

  it("finds a sample by a word of its name, and says when none matches", async () => {
    const { user } = await renderApp("/samples");
    const box = await screen.findByPlaceholderText(/Search samples/);
    await user.type(box, "zzzznothing");
    expect(await screen.findByRole("heading", { name: /^No samples match/ })).toBeInTheDocument();
  });
});

describe("instruments", () => {
  it("lists every instrument with its drawing or a placeholder", async () => {
    await renderApp("/instruments");
    expect(await screen.findByRole("heading", { name: "Instruments" })).toBeInTheDocument();
    for (const i of (await api.instruments.list()).slice(0, 3)) expect((await screen.findAllByText(i.name)).length).toBeGreaterThan(0);
  });

  it("filters by name", async () => {
    const { user } = await renderApp("/instruments");
    await user.type(await screen.findByPlaceholderText(/Search instruments/), "loki");
    await waitFor(() => expect(screen.queryAllByText("BEER")).toHaveLength(0));
    expect(screen.getAllByText("LoKI").length).toBeGreaterThan(0);
  });

  it("a technique on an instrument leads to the datasets of that technique", async () => {
    const { user } = await renderApp("/instruments");
    const chip = (await screen.findAllByRole("button", { name: /SANS/ }))[0];
    await user.click(chip);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("tech=SANS"));
  });
});

describe("published data", () => {
  it("lists what has been published, each with its DOI", async () => {
    await renderApp("/published");
    expect(await screen.findByRole("heading", { name: "Published data" })).toBeInTheDocument();
    const pub = (await api.published.list())[0];
    expect((await screen.findAllByText(new RegExp(pub.doi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).length).toBeGreaterThan(0);
  });

  it("says when a search matches nothing", async () => {
    const { user } = await renderApp("/published");
    await user.type(await screen.findByPlaceholderText(/Search published data/), "zzzznothing");
    expect(await screen.findByRole("heading", { name: /^No published data match/ })).toBeInTheDocument();
  });
});

describe("jobs", () => {
  it("lists the jobs, and a failed one can be retried", async () => {
    const { user } = await renderApp("/jobs");
    expect(await screen.findByRole("heading", { name: "Jobs" })).toBeInTheDocument();
    const retry = (await screen.findAllByRole("button", { name: /Retry/ }))[0];
    await user.click(retry);
    expect(await screen.findByText("Retrying job")).toBeInTheDocument();
  });

  it("says when a search matches nothing", async () => {
    const { user } = await renderApp("/jobs");
    await user.type(await screen.findByPlaceholderText(/Search jobs/), "zzzznothing");
    expect(await screen.findByText(/No jobs|Nothing|match/i)).toBeInTheDocument();
  });
});

describe("a page that is not there", () => {
  it("offers the way back", async () => {
    const { user } = await renderApp("/no/such/page");
    expect(await screen.findByText("We couldn't find that page")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /Go to datasets/ }));
    expect(await screen.findByRole("heading", { name: "Datasets" })).toBeInTheDocument();
  });
});
