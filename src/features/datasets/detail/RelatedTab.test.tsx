import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderInApp } from "@/test/render";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Dataset } from "@/types";
import { RelatedTab } from "./RelatedTab";

const make = (pid: string, name: string) => ({ pid, datasetName: name, instrumentName: "LoKI", creationTime: "2026-07-05T08:00:00Z", proposalId: "2024", proposalTitle: "A proposal", sampleName: "Lysozyme", thumbnailAttachmentId: undefined }) as unknown as Dataset;

vi.mock("@/api", () => ({
  api: {
    datasets: {
      related: async () => ({ sources: [make("RAW", "Raw run")], derived: [make("D1", "Reduced run"), make("D2", "Integrated run")], siblings: [] }),
    },
  },
}));
// the graph is its own chunk and needs a real layout engine: not what this test is about
vi.mock("./LineageGraph", () => ({ default: () => <div>graph</div> }));

const inApp = (ui: React.ReactElement) => renderInApp(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

describe("the Related tab", () => {
  it("lists what the dataset was made from and what was made from it", async () => {
    inApp(<RelatedTab d={make("MID", "This run")} />);
    expect(await screen.findByText("Raw run")).toBeInTheDocument();
    expect(screen.getByText("Reduced run")).toBeInTheDocument();
    expect(screen.getByText("Integrated run")).toBeInTheDocument();
    expect(screen.getByText("Derived from")).toBeInTheDocument();
    expect(screen.getByText("Derived datasets")).toBeInTheDocument();
  });

  it("links to the dataset's proposal, sample and instrument", async () => {
    inApp(<RelatedTab d={make("MID", "This run")} />);
    expect(await screen.findByRole("link", { name: /A proposal/ })).toHaveAttribute("href", "/proposals/2024");
    expect(screen.getByRole("link", { name: /Lysozyme/ })).toHaveAttribute("href", "/samples");
  });
});
