import { getGlobalPayload } from "@/lib/payload";
import type { Promise as PromiseDocument } from "@/payload-types";

// Resolved lazily per-call (memoized) rather than at module top-level, so
// importing this module does not open a MongoDB connection at build time.

type GetPromiseByIdOptions = {
  locale?: "en" | "fr";
};

export const getPromiseById = async (
  id: string,
  options: GetPromiseByIdOptions = {}
): Promise<PromiseDocument | null> => {
  const { locale } = options;
  const payload = await getGlobalPayload();

  try {
    const doc = await payload.findByID({
      collection: "promises",
      id,
      depth: 2,
      ...(locale ? { locale } : {}),
    });

    const promise = doc as PromiseDocument;
    const publishStatus =
      typeof promise.publishStatus === "string"
        ? promise.publishStatus.trim().toLowerCase()
        : null;
    if (publishStatus !== "published") {
      return null;
    }
    return promise;
  } catch (error) {
    payload.logger.warn({
      message: "getPromiseById:: Failed to load promise",
      id,
      error,
    });
    return null;
  }
};
