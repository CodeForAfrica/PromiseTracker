import { allCountries } from "@/data/countries";
import { toDate, formatISO } from "date-fns";
import {
  getAirtableCountries,
  getAirtablePoliticalEntities,
} from "@/lib/airtable";
import { TaskConfig } from "payload";
import { downloadFile } from "@/utils/files";
import { unlink } from "node:fs/promises";

export const CreatePoliticalEntity: TaskConfig = {
  slug: "createPoliticalEntity",
  label: "Create Political Entity",
  handler: async ({ req: { payload } }) => {
    const { logger } = payload;
    logger.info(
      "createPoliticalEntity:: Starting fetching political entities from Airtable"
    );

    const {
      airtable: { airtableAPIKey, airtableBaseID },
    } = await payload.findGlobal({
      slug: "settings",
    });

    if (!airtableAPIKey || !airtableBaseID) {
      logger.error(
        "createPoliticalEntity:: Airtable API Key and Base ID not configured"
      );
      throw new Error("Airtable API key or Base ID not found in settings");
    }

    try {
      const entities = await getAirtablePoliticalEntities({
        airtableAPIKey,
        airtableID: airtableBaseID,
      });

      const countries = await getAirtableCountries({
        airtableAPIKey,
        airtableID: airtableBaseID,
      });

      const { docs: existing } = await payload.find({
        collection: "political-entities",
        where: {
          name: {
            in: entities.map((e) => e.name),
          },
        },
      });
      const to_create = entities.filter(
        (t) => !existing.find((e) => e.airtableID === t.id)
      );

      for (const entity of to_create) {
        const country = countries.find((t) => t.id === entity.country[0]);

        const c = allCountries.find((t) => {
          return t.label["en"] === country?.country;
        });

        const { docs } = await payload.find({
          collection: "tenants",
          where: {
            country: {
              like: c?.value,
            },
          },
        });
        const tenant = docs[0];

        if (tenant) {
          const image = entity.image[0];
          const filePath = await downloadFile(image);

          const mediaUpload = await payload.create({
            collection: "media",
            data: {
              alt: entity.name || "",
            },
            filePath,
          });

          unlink(filePath);

          await payload.create({
            collection: "political-entities",
            data: {
              tenant,
              name: entity.name!,
              periodFrom: formatISO(toDate(entity.periodFrom! * 1000)),
              periodTo: formatISO(toDate(entity.periodTo! * 1000)),
              position: entity.title!,
              image: mediaUpload,
              region: entity.region,
              airtableID: entity.id,
            },
          });
        }
      }
    } catch (error) {
      logger.error(
        "createPoliticalEntity:: Error Fetching Document from AIrtable",
        { error }
      );
    }

    return {
      output: {},
    };
  },
};
