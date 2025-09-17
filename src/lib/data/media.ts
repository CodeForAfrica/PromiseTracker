"use server";
import type { Media } from "@/payload-types";
import type { BasePayload } from "payload";

type ResolvedMedia = {
  url: string;
  alt: string;
};

/**
 * Resolve a media relationship into a usable URL + alt pair.
 * Returns null when the media record cannot be found or is missing a URL.
 */
export const resolveMedia = async (
  payload: BasePayload,
  media: string | Media | null | undefined
): Promise<ResolvedMedia | null> => {
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
