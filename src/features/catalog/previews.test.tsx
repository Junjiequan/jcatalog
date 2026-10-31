import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderApp, resetApp } from "@/test/app";
import { useSelection } from "@/store/selection";

afterEach(resetApp);

describe("previews", () => {
  it("a sample's Preview button opens it, and the link keeps it", async () => {
    const { user } = await renderApp("/samples");
    await user.click((await screen.findAllByRole("button", { name: "Preview" }))[0]);
    expect(await screen.findByRole("button", { name: "Open details" })).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("peek=");
  });

  it("Open details leads to the sample's page, Select adds it to the selection", async () => {
    const { user } = await renderApp("/samples?peek=s01");
    await user.click(await screen.findByRole("button", { name: /Select/ }));
    expect(useSelection.getState().items["sample:s01"]).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Open details" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/samples/s01"));
  });

  it("Next moves the preview on to the following sample, Close removes it from the link", async () => {
    const { user } = await renderApp("/samples?peek=s01");
    await screen.findByRole("button", { name: "Open details" });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(screen.getByTestId("where")).not.toHaveTextContent("peek=s01"));
    await user.click(screen.getByRole("button", { name: "Close preview" }));
    await waitFor(() => expect(screen.getByTestId("where")).not.toHaveTextContent("peek="));
  });

  it("a proposal opens in a preview with its own details link", async () => {
    const { user } = await renderApp("/proposals");
    await user.click((await screen.findAllByRole("button", { name: "Preview" }))[0]);
    expect(await screen.findByRole("button", { name: "Open details" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open details" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/proposals/"));
  });
});

describe("a tag clicked on a list stays on that list", () => {
  it("an instrument on the proposals page filters proposals and shows the applied filter, which Clear all lifts", async () => {
    const { user } = await renderApp("/proposals");
    const chip = (await screen.findAllByTitle(/Show proposals on /))[0];
    await user.click(chip);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/\/proposals\?.*inst=/));
    await user.click(await screen.findByRole("button", { name: "Clear all" }));
    await waitFor(() => expect(screen.getByTestId("where")).not.toHaveTextContent("inst="));
  });

  it.each([["/experiments", "experiments"], ["/published", "published data"]])("the same on %s", async (path, noun) => {
    const { user } = await renderApp(path);
    await user.click((await screen.findAllByTitle(new RegExp(`Show ${noun} on `)))[0]);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(new RegExp(`${path}\\?.*inst=`)));
  });
});

describe("tags add up", () => {
  it("a second tag narrows the list, and the same tag again keeps the first", async () => {
    const { user } = await renderApp("/proposals");
    const inst = (await screen.findAllByTitle(/Show proposals on /))[0];
    const name = inst.getAttribute("title")!.replace("Show proposals on ", "").split(" · ")[0];
    await user.click(inst);
    await screen.findByText(new RegExp(`Instrument: ${name}`));
    const kw = (await screen.findAllByTitle(/^Show everything tagged /))[0];
    await user.click(kw);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/inst=.*kw=|kw=.*inst=/));
    await user.click((await screen.findAllByTitle(new RegExp(`Show proposals on ${name}`)))[0]);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/kw=/));
  });
});

// the panel is open by default on a wide screen; a click on the toggle would close it
async function openFilters(user: { click: (e: Element) => Promise<void> }) {
  const toggle = await screen.findByRole("button", { name: /Filters/ });
  if (toggle.getAttribute("aria-pressed") !== "true") await user.click(toggle);
}

describe("each list builds its own filters", () => {
  it("proposals offer instruments and keywords, not techniques", async () => {
    const { user } = await renderApp("/proposals");
    await openFilters(user);
    expect(await screen.findByRole("button", { name: /(Expand|Collapse) Instrument/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /(Expand|Collapse) Keywords/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /(Expand|Collapse) Technique/ })).not.toBeInTheDocument();
  });

  it("samples offer measurements, published data a date", async () => {
    const { user } = await renderApp("/samples");
    await openFilters(user);
    expect(await screen.findByRole("button", { name: /(Expand|Collapse) Measurements/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /(Expand|Collapse) Technique/ })).not.toBeInTheDocument();
  });

  it("published data offer a date", async () => {
    const { user } = await renderApp("/published");
    await openFilters(user);
    expect(await screen.findByRole("button", { name: /(Expand|Collapse) Created/ })).toBeInTheDocument();
  });

  it("the applied filters can be switched between or and and, and the list follows", async () => {
    const { user } = await renderApp("/proposals?inst=loki,skadi");
    const summary = await screen.findByRole("button", { name: /^Instrument: LoKI or SKADI/ });
    if (summary.getAttribute("aria-expanded") !== "true") await user.click(summary);
    await user.click(await screen.findByRole("button", { name: "or, click to switch" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/inst=loki(\+|%2B)skadi/));
    expect(screen.getByRole("button", { name: /^Instrument: LoKI and SKADI/ })).toBeInTheDocument();
  });
});

describe("published data", () => {
  it("a publication opens in a preview and then on its own page", async () => {
    const { user } = await renderApp("/published");
    await user.click((await screen.findAllByRole("button", { name: "Preview" }))[0]);
    expect(await screen.findByRole("button", { name: "Open details" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open details" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/\/published\/.+/));
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole("tab", { name: /Datasets/ })).toBeInTheDocument();
  });

  it("an unknown publication is reported", async () => {
    await renderApp("/published/nothing-here");
    expect(await screen.findByText("Not found")).toBeInTheDocument();
  });
});

describe("the applied filters", () => {
  it("a date reads as the panel words it", async () => {
    await renderApp("/published?from=2020-01-01");
    expect(await screen.findByText(/^Created: /)).toBeInTheDocument();
    expect(screen.queryByText(/since/)).not.toBeInTheDocument();
  });
});

describe("one value of an applied filter", () => {
  it("is taken off by clicking it, and the others stay", async () => {
    const { user } = await renderApp("/proposals?inst=loki,skadi");
    const summary = await screen.findByRole("button", { name: /^Instrument: LoKI or SKADI/ });
    if (summary.getAttribute("aria-expanded") !== "true") await user.click(summary);
    await user.click(await screen.findByRole("button", { name: "Remove LoKI" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/inst=skadi/));
    expect(screen.getByTestId("where")).not.toHaveTextContent(/loki/);
  });
});
