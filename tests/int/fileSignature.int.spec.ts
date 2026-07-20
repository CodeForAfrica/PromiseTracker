import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import {
  validateBufferSignature,
  validateFileSignature,
} from "@/utils/fileSignature";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
const GIF = Buffer.from("GIF89a-and-more");
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x10, 0x00, 0x00, 0x00]),
  Buffer.from("WEBPVP8 "),
]);
const PDF = Buffer.from("%PDF-1.7 rest of file");
const DOCX = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2]);
const DOC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 1]);

describe("validateBufferSignature", () => {
  it.each([
    ["image/png", PNG],
    ["image/jpeg", JPEG],
    ["image/gif", GIF],
    ["image/webp", WEBP],
    ["application/pdf", PDF],
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      DOCX,
    ],
    ["application/msword", DOC],
    ["text/plain", Buffer.from("just some text")],
    ["text/csv", Buffer.from("a,b,c\n1,2,3")],
  ])("accepts a genuine %s file", (mimeType, header) => {
    expect(validateBufferSignature(header, { mimeType })).toEqual({ ok: true });
  });

  it.each([
    ["image/png claimed but JPEG bytes", "image/png", JPEG],
    ["image/jpeg claimed but PNG bytes", "image/jpeg", PNG],
    ["pdf claimed but zip bytes", "application/pdf", DOCX],
    ["png claimed but HTML", "image/png", Buffer.from("<html></html>")],
    ["text claimed but binary", "text/plain", Buffer.from([0x00, 0x01, 0x02])],
    ["text claimed but PDF bytes", "text/csv", PDF],
  ])("rejects %s", (_label, mimeType, header) => {
    const result = validateBufferSignature(header, { mimeType });
    expect(result.ok).toBe(false);
  });

  it("falls back to the extension when no MIME type is claimed", () => {
    expect(validateBufferSignature(JPEG, { extension: ".jpg" })).toEqual({
      ok: true,
    });
    expect(
      validateBufferSignature(Buffer.from("nope"), { extension: ".jpg" }).ok,
    ).toBe(false);
  });

  it("passes types without a registered signature through", () => {
    expect(
      validateBufferSignature(Buffer.from("anything"), {
        mimeType: "application/x-unknown",
      }),
    ).toEqual({ ok: true });
  });
});

describe("validateFileSignature", () => {
  const dirs: string[] = [];

  afterAll(async () => {
    for (const dir of dirs) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reads the header from disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sig-spec-"));
    dirs.push(dir);
    const genuine = join(dir, "real.png");
    const spoofed = join(dir, "fake.png");
    await writeFile(genuine, PNG);
    await writeFile(spoofed, Buffer.from("MZ executable content"));

    expect(
      await validateFileSignature(genuine, { mimeType: "image/png" }),
    ).toEqual({ ok: true });
    expect(
      (await validateFileSignature(spoofed, { mimeType: "image/png" })).ok,
    ).toBe(false);
  });
});
