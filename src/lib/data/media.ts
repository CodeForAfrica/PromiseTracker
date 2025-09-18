"use server";
import type { Media } from "@/payload-types";
import { getGlobalPayload } from "@/lib/payload";

type ResolvedMedia = {
  url: string;
  alt: string;
};

export const resolveMedia = async (
  media: string | Media | null | undefined
): Promise<ResolvedMedia | null> => {
  const payload = await getGlobalPayload();

  if (!media) {
    return null;
  }

  if (typeof media === "string") {
    try {
      const doc = await payload.findByID({
        collection: "media",
        id: media,
        depth: 0,
      });

      if (doc?.url) {
        return {
          url: doc.url,
          alt: doc.alt,
        };
      }
    } catch (error) {
      payload.logger.warn({
        error,
        mediaId: media,
        message: "Failed to resolve media relationship",
      });
    }

    return null;
  }

  if (!media.url) {
    return null;
  }

  return {
    url: media.url,
    alt: media.alt,
  };
};
