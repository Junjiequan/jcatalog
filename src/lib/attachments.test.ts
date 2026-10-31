import { describe, expect, it } from "vitest";
import { bytesOf, dataUrlToText, extOf, kindOf, langOf, textToDataUrl } from "./attachments";

describe("what kind of file it is", () => {
  it.each([
    ["detector.png", "image/png", "image"],
    ["photo.JPG", "", "image"],
    ["scan.tiff", "image/tiff", "other"],
    ["report.pdf", "application/pdf", "pdf"],
    ["movie.mp4", "", "video"],
    ["clip.wav", "audio/wav", "audio"],
    ["reduce.py", "text/x-python", "code"],
    ["params.json", "application/json", "code"],   // shown with syntax colours, like a script
    ["notes.md", "text/markdown", "text"],
    ["notes.txt", "text/plain", "text"],
    ["data.h5", "application/x-hdf5", "other"],
  ])("%s (%s) is %s", (name, mime, kind) => {
    expect(kindOf(name, mime)).toBe(kind);
  });

  it("reads the extension from the last dot of the last path part", () => {
    expect(extOf("a/b.c/archive.tar.gz")).toBe("gz");
    expect(extOf("Makefile")).toBe("makefile");
    expect(extOf(".hidden")).toBe(".hidden");
  });

  it("names the language of a script", () => {
    expect(langOf("fit.py")).toBeTruthy();
    expect(langOf("notes.txt")).toBeUndefined();
  });
});

describe("data URLs", () => {
  it("round-trips text, accents included", () => {
    const text = "q_inv_angstrom,intensity\n0.01,14 µAh Å";
    expect(dataUrlToText(textToDataUrl(text))).toBe(text);
  });

  it("decodes base64 into the original bytes", () => {
    expect([...bytesOf("data:application/octet-stream;base64,AAEC/w==")]).toEqual([0, 1, 2, 255]);
  });

  it("decodes percent-encoded data too", () => {
    expect(new TextDecoder().decode(bytesOf("data:text/plain,hello%20world"))).toBe("hello world");
  });
});
