import { describe, expect, it } from "vitest";
import { classifyInput } from "./classify.ts";

const text = (s: string) => new TextEncoder().encode(s);
const codes = (r: ReturnType<typeof classifyInput>) => r.findings.map((f) => f.code);

const HTML = "<!DOCTYPE html><html><head><title>Quiz</title></head><body></body></html>";
const JSX = 'import React from "react";\nexport default function App() { return <div />; }';
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

describe("classifyInput", () => {
  it("uses known extensions", () => {
    expect(classifyInput("a.html", text(HTML)).format).toBe("html");
    expect(classifyInput("a.HTM", text(HTML)).format).toBe("html");
    expect(classifyInput("App.jsx", text(JSX)).format).toBe("jsx");
    expect(classifyInput("App.tsx", text(JSX)).format).toBe("tsx");
    expect(classifyInput("notes.md", text("# Title")).format).toBe("markdown");
    expect(classifyInput("export.zip", ZIP).format).toBe("zip");
  });

  it("keeps markdown even when it embeds HTML", () => {
    const r = classifyInput("notes.md", text("<html><body>hi</body></html>"));
    expect(r.format).toBe("markdown");
    expect(r.findings).toEqual([]);
  });

  it("treats a ZIP signature as ZIP regardless of extension", () => {
    const r = classifyInput("artifact.html", ZIP);
    expect(r.format).toBe("zip");
    expect(codes(r)).toEqual(["input.extension-mismatch"]);
  });

  it("rejects a .zip file without a ZIP signature", () => {
    const r = classifyInput("export.zip", text("not a zip"));
    expect(r.format).toBe("unknown");
    expect(codes(r)).toEqual(["input.extension-mismatch"]);
  });

  it("rejects other binary content", () => {
    const r = classifyInput("image.html", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]));
    expect(r.format).toBe("unknown");
    expect(codes(r)).toEqual(["input.binary-content"]);
  });

  it("warns when a .jsx file is really an HTML document", () => {
    const r = classifyInput("App.jsx", text(HTML));
    expect(r.format).toBe("jsx");
    expect(codes(r)).toEqual(["input.extension-mismatch"]);
  });

  it("detects format from content when the extension is unknown", () => {
    expect(classifyInput("artifact.txt", text(`  \n${HTML}`)).format).toBe("html");
    expect(classifyInput("artifact", text(JSX)).format).toBe("jsx");
    expect(codes(classifyInput("artifact", text(JSX)))).toEqual(["input.format-from-content"]);
  });

  it("reports unsupported formats", () => {
    const r = classifyInput("data.csv", text("a,b\n1,2"));
    expect(r.format).toBe("unknown");
    expect(codes(r)).toEqual(["input.unsupported-format"]);
  });

  it("warns on invalid UTF-8", () => {
    const r = classifyInput("a.html", new Uint8Array([...text("<html>"), 0xc3, 0x28]));
    expect(r.format).toBe("html");
    expect(codes(r)).toEqual(["input.invalid-utf8"]);
  });
});
