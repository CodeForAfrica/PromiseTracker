import type { Media } from "@/payload-types";

export type PromiseUpdateSettings = {
  formUrl?: string | null;
  embedCode?: string | null;
  updateLabel?: string | null;
  defaultImage: Media | null;
};
