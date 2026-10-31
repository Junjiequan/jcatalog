import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderApp, resetApp } from "./app";

afterEach(resetApp);

describe("the app, page by page, against the mock backend", () => {
  it("opens on the datasets list", async () => {
    await renderApp("/");
    expect(await screen.findByRole("heading", { name: "Datasets" })).toBeInTheDocument();
    expect(await screen.findAllByRole("row")).not.toHaveLength(0);
  });
});
