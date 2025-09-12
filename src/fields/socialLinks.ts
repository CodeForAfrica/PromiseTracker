import { deepMerge, Field } from "payload";
import { url } from "./url";

export const socialMediaOptions = [
  "Facebook",
  "Twitter",
  "Instagram",
  "Linkedin",
  "Github",
  "Slack",
];

export const socialLinks = (overrides: Partial<Field> = {}) => {
  const defaults: Field = {
    name: "links",
    type: "array",
    labels: {
      singular: {
        en: "Link",
        fr: "Lien",
      },
      plural: {
        en: "Links",
        fr: "Links",
      },
    },
    admin: {
      components: {
        RowLabel: {
          path: "@/components/payload/RowLabel#CustomRowLabel",
          clientProps: {
            fieldToUse: "platform",
          },
        },
      },
    },
    minRows: 1,
    fields: [
      {
        name: "platform",
        type: "select",
        options: socialMediaOptions,
        required: true,
      },
      url({
        overrides: {
          required: true,
        },
      }),
    ],
  };

  return deepMerge(defaults, overrides);
};
