import { getGlobalPayload } from "@/lib/payload";
import type { PromiseUpdateSettings } from "@/types/promiseUpdates";
import type { Media } from "@/payload-types";
import type { PayloadLocale } from "@/utils/locales";

const payload = await getGlobalPayload();

export const getPromiseUpdateEmbed =
  async (locale?: PayloadLocale): Promise<PromiseUpdateSettings | null> => {
    try {
      const doc = await payload.findGlobal({
        slug: "promise-updates",
        depth: 2,
        ...(locale ? { locale } : {}),
      });
      const { embedCode, updateLabel, defaultImage } = doc;

      return {
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
