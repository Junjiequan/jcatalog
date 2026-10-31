import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { api } from "@/api";
import { DEFAULT_QUERY } from "@/lib/query";
import { renderApp, resetApp } from "@/test/app";

afterEach(resetApp);

let pid = "";
beforeEach(async () => {
  await api.auth.signInDemo!("admin@example.org");
  // a seeded raw dataset of Ada's group, so Ada can attach to it and Henrik cannot
  const items = (await api.datasets.list({ ...DEFAULT_QUERY, scope: "all", pageSize: 100 })).items;
  pid = items.find((d) => d.createdBy === "ingestor" && ["ada-lab", "bio-sax"].includes(d.ownerGroup))!.pid;
});

const open = (as: "admin" | "ada" | "henrik" = "ada") => renderApp(`/datasets/${encodeURIComponent(pid)}?tab=attachments`, { as });
const upload = (name: string, body: string, type = "text/plain") => new File([body], name, { type });
const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;
const cards = () => screen.getAllByRole("button", { name: /^Preview / });

describe("attachments", () => {
  it("lists what is attached, and one picture stands for the dataset", async () => {
    await open();
    await screen.findAllByRole("button", { name: /^Preview / });
    expect(cards().length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Remove as thumbnail" })).toHaveLength(1);
  });

  it("attaches a file and says so", async () => {
    const { user } = await open();
    await screen.findAllByRole("button", { name: /^Preview / });
    const before = cards().length;
    await user.upload(fileInput(), upload("notes.txt", "first notes"));
    expect(await screen.findByText("Attached notes.txt")).toBeInTheDocument();
    expect(cards()).toHaveLength(before + 1);
  });

  it("refuses the same content again, even under another name, and says which attachment it is", async () => {
    const { user } = await open();
    await screen.findAllByRole("button", { name: /^Preview / });
    await user.upload(fileInput(), upload("notes.txt", "twice"));
    await screen.findByText("Attached notes.txt");
    await user.upload(fileInput(), upload("copy-of-notes.txt", "twice"));
    expect(await screen.findByText("Couldn't attach copy-of-notes.txt")).toBeInTheDocument();
    expect(screen.getByText("copy-of-notes.txt is already attached as notes.txt.")).toBeInTheDocument();
  });

  it("attaches several at once, and one refused file does not stop the others", async () => {
    const { user } = await open();
    await screen.findAllByRole("button", { name: /^Preview / });
    await user.upload(fileInput(), upload("a.txt", "same"));
    await screen.findByText("Attached a.txt");
    await user.upload(fileInput(), [upload("b.txt", "same"), upload("c.txt", "fresh")]);
    expect(await screen.findByText("Couldn't attach b.txt")).toBeInTheDocument();
    expect(await screen.findByText("Attached c.txt")).toBeInTheDocument();
  });

  it("makes any file the dataset's picture, and a second click on the star takes it back", async () => {
    const { user } = await open();
    await screen.findAllByRole("button", { name: /^Preview / });
    await user.upload(fileInput(), upload("picked.txt", "pick me"));
    const card = (await screen.findByRole("button", { name: "Preview picked.txt" })).closest<HTMLElement>(".card")!;
    await user.click(within(card).getByRole("button", { name: "Use as thumbnail" }));
    expect(await screen.findByText("Now the dataset's thumbnail")).toBeInTheDocument();
    expect((await api.datasets.get(pid)).thumbnailAttachmentId).toBeTruthy();
    await user.click(within(card).getByRole("button", { name: "Remove as thumbnail" }));
    expect(await screen.findByText("Thumbnail removed")).toBeInTheDocument();
    expect((await api.datasets.get(pid)).thumbnailAttachmentId).toBeFalsy();
  });

  it("removing asks first", async () => {
    const { user } = await open();
    await screen.findAllByRole("button", { name: /^Preview / });
    await user.upload(fileInput(), upload("gone.txt", "bye"));
    const card = (await screen.findByRole("button", { name: "Preview gone.txt" })).closest<HTMLElement>(".card")!;
    await user.click(within(card).getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("Remove this attachment?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Preview gone.txt" })).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Remove" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Preview gone.txt" })).not.toBeInTheDocument());
  });

  it("opens a preview of a text file", async () => {
    const { user } = await open();
    await screen.findAllByRole("button", { name: /^Preview / });
    await user.upload(fileInput(), upload("readme.txt", "line one\nline two"));
    await user.click(await screen.findByRole("button", { name: "Preview readme.txt" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await within(screen.getByRole("dialog")).findByText(/line two/)).toBeInTheDocument();
  });

  it("edits a caption in place", async () => {
    const { user } = await open();
    await screen.findAllByRole("button", { name: /^Preview / });
    await user.upload(fileInput(), upload("captioned.txt", "caption me"));
    const card = (await screen.findByRole("button", { name: "Preview captioned.txt" })).closest<HTMLElement>(".card")!;
    await user.click(within(card).getByRole("button", { name: "Add a caption" }));
    await user.type(within(card).getByRole("textbox"), "Raw counts, run 14{Enter}");
    expect(await within(card).findByText("Raw counts, run 14")).toBeInTheDocument();
    const saved = (await api.attachments.list(pid)).find((a) => a.fileName === "captioned.txt")!;
    expect(saved.caption).toBe("Raw counts, run 14");
  });

  it("a file with no inline preview offers its download instead", async () => {
    const { user } = await open();
    await screen.findAllByRole("button", { name: /^Preview / });
    await user.upload(fileInput(), upload("run.h5", "binary", "application/x-hdf5"));
    await user.click(await screen.findByRole("button", { name: "Preview run.h5" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/There is no inline preview for \.h5 files/)).toBeInTheDocument();
  });

  it("an image preview can be zoomed, reset and closed with the keyboard", async () => {
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const file = new File([Uint8Array.from(atob(png.split(",")[1]), (c) => c.charCodeAt(0))], "tiny.png", { type: "image/png" });
    const { user } = await open();
    await screen.findAllByRole("button", { name: /^Preview / });
    await user.upload(fileInput(), file);
    await user.click(await screen.findByRole("button", { name: "Preview tiny.png" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Fit to window" })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Zoom in" }));
    expect(within(dialog).getByRole("button", { name: "Fit to window" })).toBeEnabled();
    await user.click(within(dialog).getByRole("button", { name: "Fit to window" }));
    expect(within(dialog).getByRole("button", { name: "Fit to window" })).toBeDisabled();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("someone outside the group is refused a private dataset, with a reason", async () => {
    await open("henrik");
    expect(await screen.findByText(/You don't have access to this dataset/)).toBeInTheDocument();
  });

  it("on a published dataset of another group they see the attachments but cannot add, remove or pick", async () => {
    const items = (await api.datasets.list({ ...DEFAULT_QUERY, scope: "all", pageSize: 100 })).items;
    const published = items.find((d) => d.isPublished && ["ada-lab", "bio-sax"].includes(d.ownerGroup))!;
    await renderApp(`/datasets/${encodeURIComponent(published.pid)}?tab=attachments`, { as: "henrik" });
    await screen.findAllByRole("button", { name: /^Preview / });
    expect(screen.queryByText(/Drop files here/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use as thumbnail" })).not.toBeInTheDocument();
  });
});
