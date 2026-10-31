import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResizeEdge } from "./ResizeEdge";

const edge = (grows: "left" | "right", width = 400, onChange = vi.fn()) => {
  render(<ResizeEdge side="left" grows={grows} width={width} min={320} max={720} initial={400} onChange={onChange} label="Resize" />);
  return { onChange, el: screen.getByRole("separator", { name: "Resize" }) };
};

describe("ResizeEdge", () => {
  it("arrow keys change the width in the direction the panel grows, within its limits", () => {
    const { el, onChange } = edge("left");
    fireEvent.keyDown(el, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith(424);
    fireEvent.keyDown(el, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(376);
  });

  it("a panel that grows to the right reads the keys the other way round", () => {
    const { el, onChange } = edge("right", 700);
    fireEvent.keyDown(el, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(720);
  });

  it("double click puts the width back", () => {
    const { el, onChange } = edge("left", 560);
    fireEvent.doubleClick(el);
    expect(onChange).toHaveBeenLastCalledWith(400);
  });
});
