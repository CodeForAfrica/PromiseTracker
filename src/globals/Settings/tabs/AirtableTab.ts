import type { Tab } from "payload";

export const AirtableTab: Tab = {
  label: {
    en: "Airtable",
    fr: "Airtable",
  },
  fields: [
    {
      name: "airtable",
      type: "group",
      label: "",
      admin: {
        hideGutter: true,
      },
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "airtableAPIKey",
              label: {
                en: "Airtable API Key",
                fr: "Clé API Airtable",
              },
              type: "text",
              required: true,
            },
            {
              name: "airtableBaseID",
              label: {
                en: "Airtable Base ID",
                fr: "ID de Base Airtable",
              },
              type: "text",
              required: true,
            },
          ],
        },
      ],
    },
  ],
};
