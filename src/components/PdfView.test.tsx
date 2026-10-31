import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// pdf.js needs a browser to draw; what is tested here is what this component does with it
const pages = [{ n: 1 }, { n: 2 }, { n: 3 }];
const render_ = vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() }));
const getDocument = vi.fn();
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, getDocument: (...a: unknown[]) => getDocument(...a) }));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "worker.js" }));

// a box with a width, as a browser lays it out (happy-dom has no layout)
Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 800 });

const doc = () => ({
  numPages: pages.length,
  getPage: async () => ({ getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }), render: render_ }),
});

const load = async (promise: Promise<unknown>) => {
  getDocument.mockReturnValue({ promise, destroy: vi.fn() });
  const { default: PdfView } = await import("./PdfView");
  return render(<PdfView bytes={new Uint8Array([37, 80, 68, 70])} />);
};

describe("the PDF viewer", () => {
  it("draws every page and says how many there are", async () => {
    await load(Promise.resolve(doc()));
    expect(await screen.findByText("3 pages")).toBeInTheDocument();
    expect(await screen.findByLabelText("Page 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Page 3")).toBeInTheDocument();
    await waitFor(() => expect(render_).toHaveBeenCalled());
  });

  it("hands pdf.js a copy of the bytes, so the original stays usable", async () => {
    const bytes = new Uint8Array([37, 80, 68, 70]);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc()), destroy: vi.fn() });
    const { default: PdfView } = await import("./PdfView");
    render(<PdfView bytes={bytes} />);
    await screen.findByText("3 pages");
    const sent = getDocument.mock.calls.at(-1)![0].data as Uint8Array;
    expect(sent).not.toBe(bytes);
    expect([...sent]).toEqual([...bytes]);
  });

  it("zooms in and out, within limits", async () => {
    const user = userEvent.setup();
    await load(Promise.resolve(doc()));
    await screen.findByText("3 pages");
    expect(screen.getByText("100%")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("125%")).toBeInTheDocument();
    for (let i = 0; i < 12; i++) await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("300%")).toBeInTheDocument();
    for (let i = 0; i < 20; i++) await user.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("explains a file that cannot be read, and offers the download instead", async () => {
    await load(Promise.reject(new Error("Invalid PDF structure")));
    expect(await screen.findByText(/can't be shown here \(Invalid PDF structure\)/)).toBeInTheDocument();
    expect(screen.getByText(/Download it to open it in a reader/)).toBeInTheDocument();
  });
});
