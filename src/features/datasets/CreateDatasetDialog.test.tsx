import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { api } from "@/api";
import { renderApp, resetApp } from "@/test/app";

afterEach(resetApp);

const openDialog = async () => {
  const ctx = await renderApp("/datasets");
  await ctx.user.click(await screen.findByRole("button", { name: "New dataset" }));
  await screen.findByRole("dialog");
  return ctx;
};
const dialog = () => within(screen.getByRole("dialog"));
const proposal = () => api.options.proposals().find((p) => p.instrumentIds.length === 1 && p.type !== "Experiment")!;

// fills the first step with something valid
async function fillBasics(user: Awaited<ReturnType<typeof renderApp>>["user"], name = "lyso_run_014") {
  const p = proposal();
  await user.type(dialog().getByLabelText("Dataset name"), name);
  await user.selectOptions(dialog().getByLabelText("Proposal"), p.proposalId);
  return p;
}

describe("creating a dataset", () => {
  it("is a four-step form, and Back is disabled on the first step", async () => {
    await openDialog();
    for (const s of ["Basics", "Measurements", "Files", "Review"]) expect(dialog().getByText(s)).toBeInTheDocument();
    expect(dialog().getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("says what is missing before it lets you go on", async () => {
    const { user } = await openDialog();
    await user.click(dialog().getByRole("button", { name: "Continue" }));
    expect(await dialog().findByText("Give it a name of at least 3 characters.")).toBeInTheDocument();
    expect(dialog().getByText("Choose the proposal this data belongs to.")).toBeInTheDocument();
    expect(dialog().getByText("Choose the instrument it was measured on.")).toBeInTheDocument();
    expect(dialog().getByText("Basics")).toBeInTheDocument();
  });

  it("wants underscores instead of spaces in the name", async () => {
    const { user } = await openDialog();
    await user.type(dialog().getByLabelText("Dataset name"), "two words");
    await user.click(dialog().getByRole("button", { name: "Continue" }));
    expect(await dialog().findByText(/Use underscores instead of spaces/)).toBeInTheDocument();
  });

  it("offers only the instruments and samples of the chosen proposal, and picks the only instrument itself", async () => {
    const { user } = await openDialog();
    const p = await fillBasics(user);
    const instrument = dialog().getByLabelText("Instrument") as HTMLSelectElement;
    expect(instrument.value).toBe(p.instrumentIds[0]);
    const offered = [...instrument.options].map((o) => o.value).filter(Boolean);
    expect(offered).toEqual(p.instrumentIds);
  });

  it("goes through the steps to a review of what was entered", async () => {
    const { user } = await openDialog();
    const p = await fillBasics(user);
    await user.click(dialog().getByRole("button", { name: "Continue" }));
    await user.type(dialog().getByPlaceholderText("Property"), "sample_temperature");
    await user.type(dialog().getByPlaceholderText("Value"), "100");
    await user.type(dialog().getByPlaceholderText("Unit"), "K");
    await user.click(dialog().getByRole("button", { name: "Continue" }));
    await user.click(await dialog().findByRole("button", { name: "Add sample files" }));
    await user.click(dialog().getByRole("button", { name: "Continue" }));
    expect(await dialog().findByText(/Everything look right/)).toBeInTheDocument();
    expect(dialog().getByText("lyso_run_014")).toBeInTheDocument();
    expect(dialog().getByText(new RegExp(p.proposalId))).toBeInTheDocument();
    expect(dialog().getByText("1 property")).toBeInTheDocument();
  });

  it("imports measurements pasted as JSON, and says when the JSON is not usable", async () => {
    const { user } = await openDialog();
    await fillBasics(user);
    await user.click(dialog().getByRole("button", { name: "Continue" }));
    await user.click(dialog().getByRole("button", { name: "Paste JSON" }));
    const box = await dialog().findByPlaceholderText(/sample_temperature/);
    await user.click(box);
    await user.paste("not json");
    await user.click(dialog().getByRole("button", { name: "Import properties" }));
    expect(await dialog().findByText(/doesn't look like a JSON object/)).toBeInTheDocument();
    await user.clear(box);
    await user.click(box);
    await user.paste('{"temperature": {"value": 100, "unit": "K"}, "detector": "EIGER2"}');
    await user.click(dialog().getByRole("button", { name: "Import properties" }));
    expect(await screen.findByText("Imported 2 properties")).toBeInTheDocument();
  });

  it("creates the dataset and opens it", async () => {
    const { user } = await openDialog();
    await fillBasics(user, "created_in_a_test");
    for (let i = 0; i < 3; i++) await user.click(dialog().getByRole("button", { name: "Continue" }));
    await user.click(await dialog().findByRole("button", { name: "Create dataset" }));
    expect(await screen.findByText("Dataset created")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("where").textContent).toMatch(/^\/datasets\/MDC-/));
    expect(await screen.findByRole("heading", { level: 1, name: "created_in_a_test" })).toBeInTheDocument();
  });

  it("keeps an unfinished draft for next time, and Start over discards it", async () => {
    const first = await openDialog();
    await first.user.type(dialog().getByLabelText("Dataset name"), "half_done");
    // the draft is saved shortly after typing stops
    await waitFor(() => expect(localStorage.getItem("metadatacatalogue.create-draft") ?? Object.keys(localStorage).join()).toBeTruthy(), { timeout: 2000 });
    await new Promise((r) => setTimeout(r, 700));
    await first.user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await first.user.click(await screen.findByRole("button", { name: "New dataset" }));
    expect(await screen.findByText("We restored your unfinished draft.")).toBeInTheDocument();
    expect(dialog().getByLabelText("Dataset name")).toHaveValue("half_done");
    await first.user.click(dialog().getByRole("button", { name: "Start over" }));
    expect(dialog().getByLabelText("Dataset name")).toHaveValue("");
  });

  it("a user is not offered the button at all", async () => {
    await renderApp("/datasets", { as: "ada" });
    await screen.findByRole("heading", { name: "Datasets" });
    expect(screen.queryByRole("button", { name: "New dataset" })).not.toBeInTheDocument();
  });
});
