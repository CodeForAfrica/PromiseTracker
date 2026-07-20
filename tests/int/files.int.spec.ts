import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// downloadFile validates DNS resolution for every download; keep unit tests
// hermetic by resolving every hostname to a public address unless a test
// overrides the lookup explicitly.
vi.mock("node:dns/promises", () => {
  const lookup = vi.fn(async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  return { default: { lookup }, lookup };
});

import {
  downloadFile,
  removeDownloadedFile,
  sha256Buffer,
  sha256File,
} from "@/utils/files";

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

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

  describe("SSRF protections", () => {
    it("rejects plain HTTP URLs", async () => {
      const fetchMock = vi.fn(async () => new Response("content"));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        downloadFile("http://example.com/file.txt"),
      ).rejects.toThrow(/non-HTTPS/);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects URLs with embedded credentials", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => new Response("content")));

      await expect(
        downloadFile("https://user:pass@example.com/file.txt"),
      ).rejects.toThrow(/embedded credentials/);
    });

    it.each([
      ["loopback", "https://127.0.0.1/file"],
      ["private 10/8", "https://10.0.0.8/file"],
      ["private 192.168/16", "https://192.168.1.10/file"],
      ["cloud metadata", "https://169.254.169.254/latest/meta-data/"],
      ["IPv6 loopback", "https://[::1]/file"],
      ["IPv4-mapped IPv6", "https://[::ffff:127.0.0.1]/file"],
    ])("rejects %s IP-literal URLs", async (_label, url) => {
      const fetchMock = vi.fn(async () => new Response("content"));
      vi.stubGlobal("fetch", fetchMock);

      await expect(downloadFile(url)).rejects.toThrow(/blocked address/);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects hostnames that resolve to private addresses", async () => {
      const fetchMock = vi.fn(async () => new Response("content"));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        downloadFile("https://internal.example.com/file", {
          lookup: async () => [{ address: "10.1.2.3", family: 4 }],
        }),
      ).rejects.toThrow(/blocked address/);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects hostnames where any resolved address is blocked", async () => {
      const fetchMock = vi.fn(async () => new Response("content"));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        downloadFile("https://dual.example.com/file", {
          lookup: async () => [
            { address: "93.184.216.34", family: 4 },
            { address: "169.254.169.254", family: 4 },
          ],
        }),
      ).rejects.toThrow(/blocked address/);
    });

    it("rejects redirects that land on private addresses", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            headers: { location: "https://10.0.0.5/internal" },
          }),
        );
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        downloadFile("https://example.com/file"),
      ).rejects.toThrow(/blocked address/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("rejects redirects that downgrade to HTTP", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response(null, {
            status: 301,
            headers: { location: "http://example.com/file" },
          }),
        ),
      );

      await expect(
        downloadFile("https://example.com/file"),
      ).rejects.toThrow(/non-HTTPS/);
    });

    it("bounds the number of redirects", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: URL) =>
          new Response(null, {
            status: 302,
            headers: { location: `${url}x` },
          }),
        ),
      );

      await expect(
        downloadFile("https://example.com/file", { maxRedirects: 2 }),
      ).rejects.toThrow(/maximum of 2 redirects/);
    });

    it("follows safe redirects to completion", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            headers: { location: "https://cdn.example.com/file.txt" },
          }),
        )
        .mockResolvedValueOnce(new Response("redirected content"));
      vi.stubGlobal("fetch", fetchMock);

      const filePath = await downloadFile("https://example.com/file.txt");
      downloadedPaths.push(filePath);

      expect(await readFile(filePath, "utf8")).toBe("redirected content");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("applies the hostname allowlist to the initial URL", async () => {
      const fetchMock = vi.fn(async () => new Response("content"));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        downloadFile("https://evil.example.com/file", {
          allowedHostnames: ["*.checkmedia.org"],
        }),
      ).rejects.toThrow(/not in the configured allowlist/);
      expect(fetchMock).not.toHaveBeenCalled();

      const filePath = await downloadFile(
        "https://assets.checkmedia.org/file.txt",
        { allowedHostnames: ["*.checkmedia.org"] },
      );
      downloadedPaths.push(filePath);
      expect(await readFile(filePath, "utf8")).toBe("content");
    });
  });

  describe("content validation", () => {
    it("rejects downloads whose bytes do not match the content type", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response("<html>not an image</html>", {
            headers: { "content-type": "image/png" },
          }),
        ),
      );

      await expect(
        downloadFile("https://example.com/spoofed.png", {
          verifySignature: true,
        }),
      ).rejects.toThrow(/failed content validation/);
    });

    it("accepts downloads whose bytes match the content type", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response(
            new Uint8Array([...PNG_HEADER, 0x00, 0x01, 0x02]),
            { headers: { "content-type": "image/png" } },
          ),
        ),
      );

      const filePath = await downloadFile("https://example.com/real.png", {
        verifySignature: true,
      });
      downloadedPaths.push(filePath);

      expect(existsSync(filePath)).toBe(true);
    });

    it("rejects disallowed content types", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response("payload", {
            headers: { "content-type": "text/html" },
          }),
        ),
      );

      await expect(
        downloadFile("https://example.com/file", {
          allowedMimeTypes: ["image/png", "image/jpeg"],
        }),
      ).rejects.toThrow(/Unsupported content-type/);
    });
  });
});
