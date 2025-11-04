import { getGlobalPayload } from "@/lib/payload";

const payload = await getGlobalPayload();

export const getPromiseUpdateEmbed = async () => {
  try {
    const doc = await payload.findGlobal({ slug: "promise-updates" });
    const { embedCode } = doc;

    return embedCode;
  } catch (error) {
    payload.logger.error({
      message: "getPromiseUpdateEmbed:: Failed to load promise update embed",
      error,
    });
    return null;
  }
};
