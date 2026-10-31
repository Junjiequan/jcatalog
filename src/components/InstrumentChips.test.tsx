import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderInApp } from "@/test/render";
import { InstrumentChips, TechniqueChips, techniquesOf } from "./InstrumentChips";

vi.mock("@/api", () => ({
  api: { options: { instruments: () => [{ pid: "loki", name: "LoKI", title: "Broad-range SANS", techniques: ["SANS"] }, { pid: "beer", name: "BEER", title: "Engineering diffractometer", techniques: ["Engineering", "Diffraction"] }] } },
}));

describe("instrument and technique chips", () => {
  it("clicking an instrument opens the datasets filtered by it", async () => {
    renderInApp(<InstrumentChips ids={["loki"]} />);
    await userEvent.click(screen.getByRole("button", { name: /LoKI/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/datasets?scope=all&inst=loki");
  });

  it("clicking a technique opens the datasets filtered by it", async () => {
    renderInApp(<TechniqueChips names={["SANS"]} />);
    await userEvent.click(screen.getByRole("button", { name: /SANS/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/datasets?scope=all&tech=SANS");
  });

  it("filters in place, without navigating, when the page says how", async () => {
    const onPick = vi.fn();
    renderInApp(<InstrumentChips ids={["beer"]} onPick={onPick} />);
    await userEvent.click(screen.getByRole("button", { name: /BEER/ }));
    expect(onPick).toHaveBeenCalledWith("beer");
    expect(screen.getByTestId("where")).toHaveTextContent("/");
  });

  it("does not trigger the row it sits in", async () => {
    const row = vi.fn();
    renderInApp(<div onClick={row}><InstrumentChips ids={["loki"]} /></div>);
    await userEvent.click(screen.getByRole("button", { name: /LoKI/ }));
    expect(row).not.toHaveBeenCalled();
  });

  it("lists the techniques of some instruments once each", () => {
    expect(techniquesOf(["loki", "beer", "loki"])).toEqual(["SANS", "Engineering", "Diffraction"]);
  });
});
