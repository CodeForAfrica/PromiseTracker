import { getGlobalPayload } from "@/lib/payload";

const payload = await getGlobalPayload();

export const getPromiseUpdateContent = async () => {
  try {
    const doc = await payload.findGlobal({
      slug: "promise-updates",
    });

    const { embedCode } = doc;

    return {
      embedCode,
    };
  } catch (error) {
    payload.logger.error({
      message:
        "getPromiseUpdateContent:: Failed to load promise update content",
      error,
    });
    return null;
  }
};
