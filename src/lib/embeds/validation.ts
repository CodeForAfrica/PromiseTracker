/**
 * Validation and URL helpers for CMS-configured embeds.
 *
 * Kept free of heavy dependencies (no sanitize-html) because the
 * Payload field validators below are bundled into the admin client.
 * The origin allowlist lives in src/lib/security/embedPolicy.mjs and
 * is shared with the Content-Security-Policy.
 */

import {
  IFRAME_EMBED_PROVIDERS,
  FORM_ACTION_PROVIDERS,
  isAllowedFormActionUrl,
  isAllowedIframeUrl,
} from "@/lib/security/embedPolicy.mjs";

const describeHosts = (providers: { hosts: string[] }[]) =>
  providers.flatMap(({ hosts }) => hosts).join(", ");

const IFRAME_HOSTS_LABEL = describeHosts(IFRAME_EMBED_PROVIDERS);
const FORM_HOSTS_LABEL = describeHosts(FORM_ACTION_PROVIDERS);

const SCRIPT_TAG_PATTERN = /<\s*script\b/i;
const EVENT_HANDLER_PATTERN = /\son\w+\s*=/i;

/** Extracts the `src` of the first <iframe> in an embed snippet. */
export const extractIframeSrc = (
  embedCode?: string | null,
): string | null => {
  if (!embedCode) {
    return null;
  }
  const match = embedCode.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  return match?.[1]?.trim() || null;
};

export type UpdateFormSettings = {
  formUrl?: string | null;
  embedCode?: string | null;
} | null;

/**
 * Resolves the promise-update form URL from the structured `formUrl`
 * field, falling back to the src of a legacy iframe embed snippet.
 * Returns null unless the resulting URL is https and on an approved
 * iframe embed host — non-allowlisted embeds are rejected outright.
 */
export const resolveUpdateFormUrl = (
  settings: UpdateFormSettings | undefined,
): string | null => {
  if (!settings) {
    return null;
  }
  const candidate =
    settings.formUrl?.trim() || extractIframeSrc(settings.embedCode);
  return candidate && isAllowedIframeUrl(candidate) ? candidate : null;
};

export type UpdateFormPrefill = {
  promiseTitle?: string | null;
  promiseUrl?: string | null;
  updateDate?: string | Date | null;
};

const formatPrefillDate = (
  value: string | Date | null | undefined,
): string | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

/**
 * Adds Airtable prefill query params (Promise, CheckMedia Link, Date)
 * to an already-validated update form URL.
 */
export const withUpdateFormPrefill = (
  formUrl: string,
  { promiseTitle, promiseUrl, updateDate }: UpdateFormPrefill,
): string => {
  let url: URL;
  try {
    url = new URL(formUrl);
  } catch {
    return formUrl;
  }
  if (promiseTitle?.trim()) {
    url.searchParams.set("prefill_Promise", promiseTitle.trim());
  }
  if (promiseUrl?.trim()) {
    url.searchParams.set("prefill_CheckMedia Link", promiseUrl.trim());
    url.searchParams.set("hide_CheckMedia Link", "true");
  }
  const formattedDate = formatPrefillDate(updateDate);
  if (formattedDate) {
    url.searchParams.set("prefill_Date", formattedDate);
  }
  return url.toString();
};

/**
 * Derives the Mailchimp anti-bot honeypot field name (`b_<u>_<id>`)
 * from a signup form action URL, mirroring Mailchimp's own embeds.
 */
export const getMailchimpBotFieldName = (
  signupUrl: string,
): string | null => {
  try {
    const url = new URL(signupUrl);
    const u = url.searchParams.get("u");
    const id = url.searchParams.get("id");
    return u && id ? `b_${u}_${id}` : null;
  } catch {
    return null;
  }
};

/* -------------------------------------------------------------------
 * Payload field validators
 * ---------------------------------------------------------------- */

type FieldValidationResult = true | string;

/** Validates the structured promise-update form URL field. */
export const validateUpdateFormUrlField = (
  value: string | null | undefined,
): FieldValidationResult => {
  if (!value?.trim()) {
    return true;
  }
  return isAllowedIframeUrl(value)
    ? true
    : `Must be an https URL on an approved embed provider (${IFRAME_HOSTS_LABEL}).`;
};

/**
 * Validates a legacy promise-update embed snippet: it must be a plain
 * <iframe> embed from an approved provider, with no scripts or inline
 * event handlers.
 */
export const validateUpdateEmbedCodeField = (
  value: string | null | undefined,
  siblingFormUrl?: string | null,
): FieldValidationResult => {
  if (!value?.trim()) {
    return siblingFormUrl?.trim()
      ? true
      : "Provide the update form URL (preferred) or a legacy embed snippet.";
  }
  if (SCRIPT_TAG_PATTERN.test(value)) {
    return "Embed snippets must not contain <script> tags.";
  }
  if (EVENT_HANDLER_PATTERN.test(value)) {
    return "Embed snippets must not contain inline event handlers.";
  }
  const src = extractIframeSrc(value);
  if (!src) {
    return "Embed snippet must contain an <iframe> with a src attribute.";
  }
  return isAllowedIframeUrl(src)
    ? true
    : `The iframe src must be an https URL on an approved embed provider (${IFRAME_HOSTS_LABEL}).`;
};

/** Validates the structured newsletter signup form action URL field. */
export const validateNewsletterSignupUrlField = (
  value: string | null | undefined,
): FieldValidationResult => {
  if (!value?.trim()) {
    return true;
  }
  return isAllowedFormActionUrl(value)
    ? true
    : `Must be an https URL on an approved newsletter provider (${FORM_HOSTS_LABEL}).`;
};

/**
 * Validates a legacy newsletter embed snippet: no scripts, no inline
 * event handlers, no iframes, and any form action must point at an
 * approved newsletter provider. The snippet is additionally sanitized
 * at render time.
 */
export const validateNewsletterEmbedCodeField = (
  value: string | null | undefined,
  siblingSignupUrl?: string | null,
): FieldValidationResult => {
  if (!value?.trim()) {
    return siblingSignupUrl?.trim()
      ? true
      : "Provide the signup form URL (preferred) or a legacy embed snippet.";
  }
  if (SCRIPT_TAG_PATTERN.test(value)) {
    return "Embed snippets must not contain <script> tags.";
  }
  if (EVENT_HANDLER_PATTERN.test(value)) {
    return "Embed snippets must not contain inline event handlers.";
  }
  if (/<\s*iframe\b/i.test(value)) {
    return "Newsletter embeds must not contain iframes.";
  }
  const actionMatch = value.match(/<form[^>]*\saction=["']([^"']+)["']/i);
  if (actionMatch && !isAllowedFormActionUrl(actionMatch[1])) {
    return `The form action must be an https URL on an approved newsletter provider (${FORM_HOSTS_LABEL}).`;
  }
  return true;
};
