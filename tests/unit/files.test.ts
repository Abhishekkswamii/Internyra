import { describe, expect, it } from "vitest";
import { MAX_DOCUMENT_BYTES, validateTextDocument } from "@/lib/engine/files";

const enc = (s: string) => new TextEncoder().encode(s);
const TEXT = "Offer letter: Marketing Intern. Stipend 10,000 per month. Please sign and return.";

describe("validateTextDocument", () => {
  it("accepts a small UTF-8 .txt file", () => {
    const r = validateTextDocument({ name: "offer.txt", size: TEXT.length, type: "text/plain" }, enc(TEXT));
    expect(r).toEqual({ ok: true, text: TEXT });
  });

  it("enforces the size limit", () => {
    const big = new Uint8Array(MAX_DOCUMENT_BYTES + 1).fill(65);
    expect(validateTextDocument({ name: "big.txt", size: big.length, type: "text/plain" }, big)).toMatchObject({ ok: false, code: "TOO_LARGE" });
  });

  it("rejects PDFs and DOCX even when renamed to .txt (content sniffing)", () => {
    expect(validateTextDocument({ name: "offer.txt", size: 10, type: "text/plain" }, enc("%PDF-1.7 ..."))).toMatchObject({ ok: false, code: "PDF_UNSUPPORTED" });
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
    expect(validateTextDocument({ name: "offer.txt", size: zip.length, type: "" }, zip)).toMatchObject({ ok: false, code: "DOCX_UNSUPPORTED" });
  });

  it("does not trust the extension or MIME type alone", () => {
    expect(validateTextDocument({ name: "offer.exe", size: TEXT.length, type: "text/plain" }, enc(TEXT))).toMatchObject({ ok: false, code: "UNSUPPORTED_TYPE" });
    expect(validateTextDocument({ name: "offer.txt", size: TEXT.length, type: "application/x-msdownload" }, enc(TEXT))).toMatchObject({ ok: false, code: "UNSUPPORTED_TYPE" });
    const binary = new Uint8Array([...enc("Looks like text "), 0, 1, 2, ...enc(" but has NUL bytes in it for sure")]);
    expect(validateTextDocument({ name: "offer.txt", size: binary.length, type: "text/plain" }, binary)).toMatchObject({ ok: false, code: "BINARY_CONTENT" });
  });

  it("rejects invalid UTF-8 and near-empty files", () => {
    const bad = new Uint8Array([0xc3, 0x28, ...enc(" this is otherwise fine text content")]);
    expect(validateTextDocument({ name: "a.txt", size: bad.length, type: "text/plain" }, bad)).toMatchObject({ ok: false, code: "INVALID_ENCODING" });
    expect(validateTextDocument({ name: "a.txt", size: 3, type: "text/plain" }, enc("hi"))).toMatchObject({ ok: false, code: "TOO_SHORT" });
  });
});
