import type { PoliticalEntity, Tenant } from "@/payload-types";

export const PAYLOAD_SUPPORTED_LOCALES = ["en", "fr"] as const;
export type PayloadLocale = (typeof PAYLOAD_SUPPORTED_LOCALES)[number];

const SUPPORTED_LOCALE_SET = new Set<PayloadLocale>(PAYLOAD_SUPPORTED_LOCALES);

const normalizeLocale = (value?: string | null): PayloadLocale | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return SUPPORTED_LOCALE_SET.has(normalized as PayloadLocale)
    ? (normalized as PayloadLocale)
    : null;
};

const buildLocales = (): PayloadLocale[] => {
  const raw = process.env.NEXT_PUBLIC_LOCALES;
  const envLocales =
    raw
      ?.split(",")
      .map((entry) => normalizeLocale(entry))
      .filter(
        (locale): locale is PayloadLocale => typeof locale === "string"
      ) ?? [];

  return envLocales.length ? envLocales : ["en"];
};

export const locales: PayloadLocale[] = buildLocales();

export const defaultLocale: PayloadLocale =
  normalizeLocale(process.env.NEXT_PUBLIC_DEFAULT_LOCALE) ??
  locales[0] ??
  "en";

export const LANGUAGE_MAP: Record<string, PayloadLocale> = {
  English: "en",
  French: "fr",
};

export const resolveTenantLocale = (
  tenant?: Tenant | null,
  fallback: PayloadLocale = defaultLocale
): PayloadLocale => {
  return normalizeLocale(tenant?.locale) ?? fallback;
};

export const resolveEntityLocale = (
  entity?: PoliticalEntity | null,
  fallback: PayloadLocale = defaultLocale
): PayloadLocale => {
  const tenantRelation = entity?.tenant;
  if (
    tenantRelation &&
    typeof tenantRelation === "object" &&
    "locale" in tenantRelation
  ) {
    return resolveTenantLocale(tenantRelation as Tenant, fallback);
  }

  return fallback;
};
