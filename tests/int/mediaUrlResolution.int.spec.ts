import { afterEach, describe, expect, it } from "vitest";

import { resolveMediaUrl } from "@/tasks/extractDocuments";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

const setAppUrl = (value: string | undefined) => {
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = value;
  }
};

afterEach(() => {
  setAppUrl(originalAppUrl);
});

describe("resolveMediaUrl", () => {
  it("resolves a relative media URL against the configured origin", () => {
    setAppUrl("https://promisetracker.example.org");

    expect(resolveMediaUrl("/api/media/file/report.pdf")).toEqual({
      url: "https://promisetracker.example.org/api/media/file/report.pdf",
      isSameOrigin: true,
    });
  });

  it("leaves an already absolute same-origin URL untouched", () => {
    // Payload returns absolute URLs whenever `serverURL` is configured;
    // concatenating would produce `https://host/https://host/...`.
    setAppUrl("https://promisetracker.example.org");

    expect(
      resolveMediaUrl(
        "https://promisetracker.example.org/api/media/file/report.pdf",
      ),
    ).toEqual({
      url: "https://promisetracker.example.org/api/media/file/report.pdf",
      isSameOrigin: true,
    });
  });

  it("ignores a trailing slash and port differences when comparing origins", () => {
    setAppUrl("http://localhost:3000/");

    expect(resolveMediaUrl("/api/media/file/report.pdf")).toEqual({
      url: "http://localhost:3000/api/media/file/report.pdf",
      isSameOrigin: true,
    });
    expect(
      resolveMediaUrl("http://localhost:4000/api/media/file/report.pdf")
        ?.isSameOrigin,
    ).toBe(false);
  });

  it("flags a foreign absolute URL as cross-origin", () => {
    setAppUrl("https://promisetracker.example.org");

    expect(resolveMediaUrl("https://cdn.example.net/report.pdf")).toEqual({
      url: "https://cdn.example.net/report.pdf",
      isSameOrigin: false,
    });
  });

  it("returns null for a relative URL when no usable origin is configured", () => {
    setAppUrl(undefined);
    expect(resolveMediaUrl("/api/media/file/report.pdf")).toBeNull();

    setAppUrl("not-a-url");
    expect(resolveMediaUrl("/api/media/file/report.pdf")).toBeNull();
  });
});
