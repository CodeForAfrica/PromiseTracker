import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  downloadFile,
  removeDownloadedFile,
  sha256Buffer,
  sha256File,
} from "@/utils/files";

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

describe("sha256Buffer", () => {
  it("hashes buffer contents", () => {
    expect(sha256Buffer(Buffer.from("hello"))).toBe(sha256("hello"));
  });
});

describe("sha256File", () => {
  it("hashes file contents from disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "files-spec-"));
    const filePath = join(dir, "sample.txt");
    await writeFile(filePath, "promise tracker");

    try {
      expect(await sha256File(filePath)).toBe(sha256("promise tracker"));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("downloadFile", () => {
  const downloadedPaths: string[] = [];

  afterEach(async () => {
    vi.unstubAllGlobals();
    for (const path of downloadedPaths.splice(0)) {
      await removeDownloadedFile(path);
    }
  });

  it("streams the response body to disk", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("downloaded content")),
    );

    const filePath = await downloadFile("https://example.com/file.txt");
    downloadedPaths.push(filePath);

    expect(await readFile(filePath, "utf8")).toBe("downloaded content");
  });

  it("rejects downloads that exceed the size limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("x".repeat(64))),
    );

    await expect(
      downloadFile("https://example.com/file.txt", { maxBytes: 16 }),
    ).rejects.toThrow(/exceeds size limit/);
  });

  it("names the file after the provided fileName", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("content")));

    const filePath = await downloadFile("https://example.com/file", {
      fileName: "Ruto Manifesto 2022",
    });
    downloadedPaths.push(filePath);

    expect(basename(filePath)).toBe("ruto-manifesto-2022.txt");
    expect(await readFile(filePath, "utf8")).toBe("content");
  });

  it("sanitizes hostile file names", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("content")));

    const filePath = await downloadFile("https://example.com/file", {
      fileName: "../../etc/passwd",
    });
    downloadedPaths.push(filePath);

    expect(basename(filePath)).toBe("etcpasswd.txt");
  });

  it("removes the per-download directory on cleanup", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("content")));

    const filePath = await downloadFile("https://example.com/file", {
      fileName: "Named Download",
    });
    const downloadDir = dirname(filePath);

    await removeDownloadedFile(filePath);

    expect(existsSync(downloadDir)).toBe(false);
  });

  it("removes unnamed downloads without touching the temp dir", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("content")));

    const filePath = await downloadFile("https://example.com/file");
    const tempRoot = dirname(filePath);

    await removeDownloadedFile(filePath);

    expect(existsSync(filePath)).toBe(false);
    expect(existsSync(tempRoot)).toBe(true);
  });
});
