import { getGlobalPayload } from "@/lib/payload";
import type { Promise as PromiseDocument } from "@/payload-types";

const payload = await getGlobalPayload();

export const getPromiseById = async (
  id: string
): Promise<PromiseDocument | null> => {
  try {
    const doc = await payload.findByID({
      collection: "promises",
      id,
      depth: 2,
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
