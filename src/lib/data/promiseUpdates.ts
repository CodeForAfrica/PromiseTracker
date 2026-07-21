import { getGlobalPayload } from "@/lib/payload";
import type { PromiseUpdateSettings } from "@/types/promiseUpdates";
import type { Media } from "@/payload-types";
import type { PayloadLocale } from "@/utils/locales";

// Resolved lazily per-call (memoized) rather than at module top-level, so
// importing this module does not open a MongoDB connection at build time.
export const getPromiseUpdateEmbed =
  async (locale?: PayloadLocale): Promise<PromiseUpdateSettings | null> => {
    const payload = await getGlobalPayload();
    try {
      const doc = await payload.findGlobal({
        slug: "promise-updates",
        depth: 2,
        ...(locale ? { locale } : {}),
      });
      const { formUrl, embedCode, updateLabel, defaultImage } = doc;

      return {
        formUrl,
        embedCode,
        updateLabel,
        defaultImage: defaultImage as Media,
      };
    } catch (error) {
      payload.logger.error({
        message: "getPromiseUpdateEmbed:: Failed to load promise update embed",
        error,
      });
      return null;
    }
  };
