import { headers } from "next/headers";
import {
  PAYLOAD_SUPPORTED_LOCALES,
  type PayloadLocale,
} from "@/utils/locales";

export const resolveBrowserLocale = async (): Promise<PayloadLocale> => {
  const headerList = await headers();
  const acceptLanguage = headerList.get("accept-language");
  if (!acceptLanguage) {
    return "en";
  }

  const supported = new Set<PayloadLocale>(PAYLOAD_SUPPORTED_LOCALES);
  const candidates = acceptLanguage
    .split(",")
    .map((entry) => entry.trim().split(";")[0]?.toLowerCase())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (supported.has(candidate as PayloadLocale)) {
      return candidate as PayloadLocale;
    }

    const [base] = candidate.split("-");
    if (base && supported.has(base as PayloadLocale)) {
      return base as PayloadLocale;
    }
  }

  return "en";
};
