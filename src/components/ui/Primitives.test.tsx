import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackButton, Badge, Field, Segmented, TabBar } from "./Primitives";
import { fitColumns, type Column } from "./Table";
import { TagInput, MAX_TAG } from "./TagInput";
import { KeywordChips } from "./badges";

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

describe("fitting a table's columns", () => {
  // the first column asks for 280px, any other 120px unless it says otherwise
  const col = (key: string, over: Partial<Column<unknown>> = {}): Column<unknown> => ({ key, label: key, render: () => null, ...over });
  const keys = (cs: Column<unknown>[]) => cs.map((c) => c.key);
  const many = [col("name"), col("a"), col("b"), col("c"), col("d")];

  it("keeps every column when there is room", () => {
    expect(keys(fitColumns(many, 1400))).toEqual(["name", "a", "b", "c", "d"]);
  });

  it("drops columns from the right as the table narrows, always keeping the first", () => {
    expect(keys(fitColumns(many, 700))).toEqual(["name", "a", "b", "c"]);
    expect(keys(fitColumns(many, 520))).toEqual(["name", "a", "b"]);
    expect(keys(fitColumns(many, 300))).toEqual(["name"]);
    expect(keys(fitColumns(many, 100))).toEqual(["name"]);
  });

  it("lets a column's rank decide what stays: rank 0 goes last", () => {
    const cs = [col("name"), col("a"), col("b"), col("c"), col("count", { fit: { rank: 0 } })];
    expect(keys(fitColumns(cs, 640))).toEqual(["name", "a", "b", "count"]);
  });

  it("counts a column by the width it says it needs", () => {
    const cs = [col("name"), col("wide", { fit: { width: 400 } }), col("slim", { fit: { width: 60 } })];
    expect(keys(fitColumns(cs, 650))).toEqual(["name", "slim"]);
    expect(keys(fitColumns(cs, 800))).toEqual(["name", "wide", "slim"]);
  });

  it("makes room for the tick box and the open arrow", () => {
    const cs = [col("name"), col("a"), col("b"), col("c")];
    expect(keys(fitColumns(cs, 700))).toEqual(["name", "a", "b", "c"]);
    expect(keys(fitColumns(cs, 700, { selection: true, trailing: true }))).toEqual(["name", "a", "b"]);
  });

  it("keeps a thumbnail beside the first column", () => {
    const cs = [col("thumb", { narrow: true }), col("name"), col("a"), col("b"), col("c")];
    expect(keys(fitColumns(cs, 640))).toEqual(["thumb", "name", "a", "b"]);
  });

  it("drops nothing before the table has been measured", () => {
    expect(fitColumns(many, 0)).toBe(many);
  });
});

describe("tags", () => {
  const long = "csaddasdadasdasadsdsadsaaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

  it("a keyword far too long is cut when it is added", async () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);
    const box = screen.getByRole("textbox");
    await userEvent.click(box);
    await userEvent.paste(long);
    await userEvent.keyboard("{Enter}");
    const added = onChange.mock.calls.at(-1)![0][0] as string;
    expect(added.length).toBeLessThanOrEqual(MAX_TAG);
  });

  it("a long keyword ends in an ellipsis in its chip, with the whole word on hover", () => {
    render(<KeywordChips words={[long]} />);
    const text = screen.getByTitle(long);
    expect(text).toHaveClass("truncate");
  });

  it("shows how many more there are instead of making the row longer", () => {
    render(<KeywordChips words={["a", "b", "c", "d"]} max={2} />);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});
