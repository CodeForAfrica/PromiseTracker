import { Field, Tab } from "payload";
import image from "@/fields/image";
import richText from "@/fields/richText";

export const GeneralTab: Tab = {
  label: {
    en: "General",
    fr: "Général",
  },
  fields: [
    {
      type: "collapsible",
      label: "Title & Description",
      fields: [
        {
          name: "title",
          type: "text",
          required: true,
          localized: true,
        },
        richText({
          name: "description",
          type: "richText",
          required: true,
          localized: true,
        }) as Field,
      ],
    },
    {
      type: "collapsible",
      label: "Logos",
      fields: [
        image({
          overrides: {
            name: "primaryLogo",
            required: true,
          },
        }),
        image({
          overrides: {
            name: "secondaryLogo",
            required: true,
          },
        }),
        image({
          overrides: {
            name: "organisationLogo",
            required: true,
          },
        }),
      ],
    },
  ],
};
