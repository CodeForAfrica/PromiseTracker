import { countriesByContinent, getCountryFlag } from "@/data/countries";
import { airtableID } from "@/fields/airtableID";
import { CollectionConfig } from "payload";

const africanCountries = countriesByContinent("Africa");
const exportRowSyncQueue = process.env.PAYLOAD_JOBS_QUEUE || "everyMinute";

export const Tenants: CollectionConfig = {
  slug: "tenants",
  access: {
    read: ({ req }) => Boolean(req.user),
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "locale", "publish"],
    group: {
      en: "Settings",
      fr: "Paramètres",
    },
  },
  labels: {
    singular: {
      en: "Tenant",
      fr: "Locataire",
    },
    plural: {
      en: "Tenants",
      fr: "Locataires",
    },
  },
  fields: [
    {
      name: "name",
      type: "text",
      label: {
        en: "Name",
        fr: "Nom",
      },
      required: true,
    },
    {
      name: "locale",
      type: "select",
      label: {
        en: "Locale",
        fr: "Lieu",
      },
      required: true,
      options: [
        {
          value: "en",
          label: {
            en: "English",
            fr: "Anglais",
          },
        },
        {
          value: "fr",
          label: {
            en: "French",
            fr: "Français",
          },
        },
      ],
    },
    {
      name: "country",
      type: "select",
      options: africanCountries,
      unique: true,
      required: true,
      label: {
        en: "Country",
        fr: "Pays",
      },
    },
    {
      name: "publish",
      type: "checkbox",
      label: {
        en: "Publish",
        fr: "Publier",
      },
      defaultValue: false,
      admin: {
        position: "sidebar",
        readOnly: true,
      },
    },
    airtableID(),
  ],
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        try {
          await req.payload.jobs.queue({
            input: {
              scope: "tenant",
              tenantId: String(doc.id),
            },
            overrideAccess: true,
            queue: exportRowSyncQueue,
            req,
            task: "syncAIExtractionExportRows",
          });
        } catch (err) {
          req.payload.logger.error({
            err,
            msg: "Failed to queue AI extraction export row sync after tenant change",
            tenantId: String(doc.id),
          });
        }
        return doc;
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        try {
          await req.payload.jobs.queue({
            input: {
              scope: "tenant",
              tenantId: String(doc.id),
            },
            overrideAccess: true,
            queue: exportRowSyncQueue,
            req,
            task: "syncAIExtractionExportRows",
          });
        } catch (err) {
          req.payload.logger.error({
            err,
            msg: "Failed to queue AI extraction export row sync after tenant delete",
            tenantId: String(doc.id),
          });
        }
        return doc;
      },
    ],
    afterRead: [
      async ({ doc }) => {
        doc.flag = getCountryFlag(doc.country);
        return doc;
      },
    ],
  },
};
