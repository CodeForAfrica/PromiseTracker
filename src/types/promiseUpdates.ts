import type { Media } from "@/payload-types";

export type PromiseUpdateSettings = {
  embedCode: string;
  updateLabel?: string | null;
  defaultImage: Media | null;
};
