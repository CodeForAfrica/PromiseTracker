import { Field, deepMerge } from "payload";

export const image = (overrides: Partial<Field> = {}) => {
  const defaults: Field = {
    name: "image",
    type: "upload",
    relationTo: "media",
    filterOptions: {
      mimeType: { contains: "image" },
    },
  };

  return deepMerge(defaults, overrides);
};
