/**
 * Server-side sanitization for legacy CMS-authored newsletter embed
 * HTML (Mailchimp signup snippets). New configurations should use the
 * structured `signupUrl` field instead; this is the safety net for
 * snippets that predate it.
 *
 * Policy: static markup and signup-form elements only. Scripts,
 * styles, iframes, inline event handlers, and non-https URLs are
 * stripped, and any <form> whose action is not on an approved
 * newsletter provider (see src/lib/security/embedPolicy.mjs) is
 * removed entirely.
 */

import sanitizeHtml from "sanitize-html";

import { isAllowedFormActionUrl } from "@/lib/security/embedPolicy.mjs";

const ALLOWED_INPUT_TYPES = new Set([
  "text",
  "email",
  "submit",
  "hidden",
  "checkbox",
  "radio",
]);

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    "div",
    "p",
    "span",
    "strong",
    "em",
    "small",
    "br",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "a",
    "form",
    "label",
    "input",
    "button",
  ],
  allowedAttributes: {
    "*": ["class", "id"],
    form: ["class", "id", "action", "method", "target", "name", "novalidate"],
    input: [
      "class",
      "id",
      "type",
      "name",
      "value",
      "placeholder",
      "required",
      "tabindex",
      "autocomplete",
      "aria-label",
      "aria-hidden",
      "aria-required",
    ],
    label: ["class", "id", "for"],
    button: ["class", "id", "type", "name"],
    a: ["class", "id", "href", "target", "rel"],
  },
  allowedSchemes: ["https", "mailto"],
  allowProtocolRelative: false,
  exclusiveFilter: (frame) => {
    if (frame.tag === "form") {
      return !isAllowedFormActionUrl(frame.attribs?.action);
    }
    if (frame.tag === "input") {
      const type = (frame.attribs?.type || "text").toLowerCase();
      return !ALLOWED_INPUT_TYPES.has(type);
    }
    return false;
  },
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: "noopener noreferrer" },
    }),
  },
};

export const sanitizeNewsletterEmbedHtml = (html: string): string =>
  sanitizeHtml(html, sanitizeOptions);
