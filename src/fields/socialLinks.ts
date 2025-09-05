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
