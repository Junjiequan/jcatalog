import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackButton, Badge, Field, Segmented, TabBar } from "./Primitives";

describe("TabBar", () => {
  const tabs = [{ id: "overview", label: "Overview" }, { id: "files", label: "Files", count: 3141 }, { id: "history", label: "History", count: 0 }];

  it("shows the labels and counts, and marks the current tab", () => {
    render(<TabBar tabs={tabs} value="files" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: /Files/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("3,141")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("reports the tab that was clicked", async () => {
    const onChange = vi.fn();
    render(<TabBar tabs={tabs} value="overview" onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: /History/ }));
    expect(onChange).toHaveBeenCalledWith("history");
  });

  it("only ever scrolls sideways", () => {
    render(<TabBar tabs={tabs} value="overview" onChange={() => {}} />);
    const list = screen.getByRole("tablist");
    expect(list).toHaveClass("overflow-x-auto", "overflow-y-hidden");
  });
});

describe("BackButton", () => {
  it("says Back and calls back", async () => {
    const onClick = vi.fn();
    render(<BackButton onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
  it("can be disabled", () => {
    render(<BackButton onClick={() => {}} disabled />);
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });
});

describe("Segmented", () => {
  it("selects the clicked option", async () => {
    const onChange = vi.fn();
    render(<Segmented value="in" onChange={onChange} options={[{ value: "in", label: "Sign in" }, { value: "up", label: "Sign up" }]} />);
    await userEvent.click(screen.getByRole("tab", { name: "Sign up" }));
    expect(onChange).toHaveBeenCalledWith("up");
  });
});

describe("Badge", () => {
  it("shows its text", () => {
    render(<Badge tone="accent">Raw</Badge>);
    expect(screen.getByText("Raw")).toBeInTheDocument();
  });
});

describe("Field", () => {
  it("ties the label to its input, so the box has a name", () => {
    render(<Field label="Email"><input /></Field>);
    expect(screen.getByLabelText("Email")).toBeInstanceOf(HTMLInputElement);
  });

  it("finds the input inside a wrapper, as a password box with a button around it", () => {
    render(<Field label="Password"><div><input type="password" /><button>Show</button></div></Field>);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("keeps an id the input already has", () => {
    render(<Field label="Name"><input id="mine" /></Field>);
    expect(screen.getByLabelText("Name")).toHaveAttribute("id", "mine");
  });

  it("describes the input with its hint, or with its error instead", () => {
    const { rerender } = render(<Field label="Password" hint="At least 8 characters."><input /></Field>);
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("At least 8 characters.");
    rerender(<Field label="Password" hint="At least 8 characters." error="Too short."><input /></Field>);
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Too short.");
    expect(screen.getByRole("alert")).toHaveTextContent("Too short.");
  });

  it("labels a choice that is not a native control as a group", () => {
    render(<Field label="Account type"><Segmented value="user" onChange={() => {}} options={[{ value: "user", label: "User" }, { value: "admin", label: "Administrator" }]} /></Field>);
    expect(screen.getByRole("group", { name: "Account type" })).toBeInTheDocument();
  });
});
