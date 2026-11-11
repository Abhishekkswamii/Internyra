/**
 * Validation for uploaded documents. Only plain-text (.txt) files are supported in this
 * phase; PDF/DOCX extraction is not implemented. Files are read in the browser, checked
 * here, and only the extracted text is sent for analysis. The file itself is not stored.
 *
 * Extension and MIME type are not trusted on their own: the bytes are sniffed too.
 */

import { MAX_TEXT_LENGTH } from "./text";
import { MIN_TEXT_LENGTH } from "./request";

export const MAX_DOCUMENT_BYTES = 100 * 1024;
export const ALLOWED_DOCUMENT_EXTENSIONS = [".txt"];
const ALLOWED_MIME = ["", "text/plain"];

export type DocumentValidation = { ok: true; text: string } | { ok: false; code: string; message: string };

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  return sig.every((b, i) => bytes[i] === b);
}

export function validateTextDocument(file: { name: string; size: number; type: string }, bytes: Uint8Array): DocumentValidation {
  const name = file.name.toLowerCase();
  if (file.size > MAX_DOCUMENT_BYTES || bytes.length > MAX_DOCUMENT_BYTES) {
    return { ok: false, code: "TOO_LARGE", message: `That file is larger than ${MAX_DOCUMENT_BYTES / 1024} KB. Paste the relevant part into the Recruiter Message tab instead.` };
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46]) || name.endsWith(".pdf")) {
    return { ok: false, code: "PDF_UNSUPPORTED", message: "Only plain-text .txt files are supported. PDF text extraction isn't available yet. Copy the offer text and paste it into the Recruiter Message tab." };
  }
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || name.endsWith(".docx") || name.endsWith(".doc")) {
    return { ok: false, code: "DOCX_UNSUPPORTED", message: "Word document extraction isn't available yet. Copy the offer text and paste it into the Recruiter Message tab." };
  }
  if (!ALLOWED_DOCUMENT_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return { ok: false, code: "UNSUPPORTED_TYPE", message: "Only plain-text (.txt) files are supported right now." };
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return { ok: false, code: "UNSUPPORTED_TYPE", message: "This file doesn't appear to be plain text." };
  }
  if (bytes.subarray(0, 8192).includes(0)) {
    return { ok: false, code: "BINARY_CONTENT", message: "This file contains binary data, not plain text." };
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, code: "INVALID_ENCODING", message: "This file isn't valid UTF-8 text." };
  }
  text = text.replace(/^﻿/, "").trim();
  if (text.length < MIN_TEXT_LENGTH) {
    return { ok: false, code: "TOO_SHORT", message: "This file has too little text to analyse." };
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return { ok: false, code: "TOO_LONG", message: `This file has more than ${MAX_TEXT_LENGTH.toLocaleString("en-US")} characters. Paste the relevant part into the Recruiter Message tab instead.` };
  }
  return { ok: true, text };
}
