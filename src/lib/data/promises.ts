import { getGlobalPayload } from "@/lib/payload";
import type { Promise as PromiseDocument } from "@/payload-types";

const payload = await getGlobalPayload();

type GetPromiseByIdOptions = {
  locale?: "en" | "fr";
};

export const getPromiseById = async (
  id: string,
  options: GetPromiseByIdOptions = {}
): Promise<PromiseDocument | null> => {
  const { locale } = options;

  try {
    const doc = await payload.findByID({
      collection: "promises",
      id,
      depth: 2,
      ...(locale ? { locale } : {}),
    });

    return doc as PromiseDocument;
  } catch (error) {
    payload.logger.warn({
      message: "getPromiseById:: Failed to load promise",
      id,
      error,
    });
    return null;
  }
};
