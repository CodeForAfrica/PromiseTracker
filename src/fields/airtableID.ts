import { Field, deepMerge } from "payload";

export const airtableID = (overrides: Partial<Field> = {}) => {
  const defaults: Field = {
    name: "airtableID",
    label: {
      en: "Airtable ID",
      fr: "ID Airtable ",
    },
    type: "text",
    unique: true,
    admin: {
      position: "sidebar",
      readOnly: true,
    },
  };

  return deepMerge(defaults, overrides);
};
