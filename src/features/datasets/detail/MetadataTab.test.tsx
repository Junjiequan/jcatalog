import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderInApp } from "@/test/render";
import type { Dataset } from "@/types";
import { MetadataTab } from "./MetadataTab";

const dataset = {
  datasetName: "LOKI0001",
  scientificMetadata: {
    source_frequency: { value: 14, unit: "Hz", group: "Beam" },
    proton_charge: { value: 1013, unit: "µAh", group: "Beam" },
    sample_temperature: { value: 298, unit: "K", group: "Sample" },
  },
} as unknown as Dataset;

describe("the Measurements tab", () => {
  it("lists every property under its group", () => {
    renderInApp(<MetadataTab d={dataset} />);
    expect(screen.getByText("Source frequency")).toBeInTheDocument();
    expect(screen.getByText("Sample temperature")).toBeInTheDocument();
    expect(screen.getByText("Beam")).toBeInTheDocument();
    expect(screen.getByText("Sample")).toBeInTheDocument();
  });

  it("finds a row from text copied out of it, like \"14 Hz\"", async () => {
    renderInApp(<MetadataTab d={dataset} />);
    await userEvent.type(screen.getByPlaceholderText(/Filter by name, value or unit/), "14 Hz");
    expect(screen.getByText("Source frequency")).toBeInTheDocument();
    expect(screen.queryByText("Proton charge")).not.toBeInTheDocument();
  });

  it("treats underscores and spaces alike, and every word must match", async () => {
    renderInApp(<MetadataTab d={dataset} />);
    const box = screen.getByPlaceholderText(/Filter by name, value or unit/);
    await userEvent.type(box, "source_frequency");
    expect(screen.getByText("Source frequency")).toBeInTheDocument();
    await userEvent.clear(box);
    await userEvent.type(box, "source kelvin");
    expect(screen.getByText("No properties match")).toBeInTheDocument();
  });

  it("says so when nothing matches", async () => {
    renderInApp(<MetadataTab d={dataset} />);
    await userEvent.type(screen.getByPlaceholderText(/Filter by name/), "zzz");
    expect(screen.getByText("No properties match")).toBeInTheDocument();
  });
});
