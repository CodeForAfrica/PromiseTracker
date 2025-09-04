import { deepmerge } from "@mui/utils";
import { Field } from "payload";

function image({
  overrides = undefined,
}: {
  overrides?: Omit<Field, "relationTo" | "type" | "filterOptions"> & {
    name?: string;
    required?: boolean;
  };
} = {}): Field {
  const imageResult: Field = {
    name: "image",
    type: "upload",
    relationTo: "media",
    filterOptions: {
      mimeType: { contains: "image" },
    },
  };

  return deepmerge(imageResult, overrides);
}

export default image;
