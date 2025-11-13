import { getGlobalPayload } from "@/lib/payload";
import type { PromiseUpdateSettings } from "@/types/promiseUpdates";

const payload = await getGlobalPayload();

export const getPromiseUpdateEmbed =
  async (): Promise<PromiseUpdateSettings | null> => {
    try {
      const doc = await payload.findGlobal({ slug: "promise-updates" });
      const { embedCode, updateLabel } = doc;

      return { embedCode, updateLabel };
    } catch (error) {
      payload.logger.error({
        message: "getPromiseUpdateEmbed:: Failed to load promise update embed",
        error,
      });
    return null;
  }
};
