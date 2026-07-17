import { describe, expect, it } from "vitest";

import {
  inferUploadKindFromMetadata,
  validateUploadMetadata,
} from "@/app/api/airtable-upload/utils";

describe("validateUploadMetadata", () => {
  it("accepts consistent extension + MIME pairs", () => {
    expect(
      validateUploadMetadata(
        { fileName: "report.pdf", mimeType: "application/pdf" },
        "document",
      ),
    ).toEqual({ ok: true });
    expect(
      validateUploadMetadata(
        { fileName: "photo.jpg", mimeType: "image/jpeg" },
        "entityImage",
      ),
    ).toEqual({ ok: true });
    expect(
      validateUploadMetadata(
        { fileName: "data.csv", mimeType: "text/csv" },
        "document",
      ),
    ).toEqual({ ok: true });
  });

  it("rejects a MIME type that does not match the extension", () => {
    const result = validateUploadMetadata(
      { fileName: "photo.png", mimeType: "image/jpeg" },
      "entityImage",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(415);
      expect(result.message).toMatch(/does not match/);
    }
  });

  it("rejects files with only one valid signal (extension or MIME)", () => {
    // Allowed extension but missing/foreign MIME type.
    expect(
      validateUploadMetadata(
        { fileName: "report.pdf", mimeType: "application/octet-stream" },
        "document",
      ).ok,
    ).toBe(false);
    expect(
      validateUploadMetadata({ fileName: "report.pdf" }, "document").ok,
    ).toBe(false);
    // Allowed MIME type but extension-less/foreign filename.
    expect(
      validateUploadMetadata(
        { fileName: "report", mimeType: "application/pdf" },
        "document",
      ).ok,
    ).toBe(false);
    expect(
      validateUploadMetadata(
        { fileName: "report.exe", mimeType: "application/pdf" },
        "document",
      ).ok,
    ).toBe(false);
  });

  it("rejects SVG uploads entirely", () => {
    expect(
      validateUploadMetadata(
        { fileName: "logo.svg", mimeType: "image/svg+xml" },
        "entityImage",
      ).ok,
    ).toBe(false);
  });

  it("rejects a document masquerading as an image kind and vice versa", () => {
    expect(
      validateUploadMetadata(
        { fileName: "report.pdf", mimeType: "application/pdf" },
        "entityImage",
      ).ok,
    ).toBe(false);
    expect(
      validateUploadMetadata(
        { fileName: "photo.png", mimeType: "image/png" },
        "document",
      ).ok,
    ).toBe(false);
  });
});

describe("inferUploadKindFromMetadata", () => {
  it("infers the kind when the metadata is unambiguous", () => {
    expect(
      inferUploadKindFromMetadata({
        fileName: "report.pdf",
        mimeType: "application/pdf",
      }),
    ).toBe("document");
    expect(
      inferUploadKindFromMetadata({
        fileName: "photo.webp",
        mimeType: "image/webp",
      }),
    ).toBe("entityImage");
  });

  it("returns null for metadata valid for no kind", () => {
    expect(
      inferUploadKindFromMetadata({
        fileName: "script.sh",
        mimeType: "text/x-shellscript",
      }),
    ).toBeNull();
    expect(
      inferUploadKindFromMetadata({
        fileName: "logo.svg",
        mimeType: "image/svg+xml",
      }),
    ).toBeNull();
  });
});
