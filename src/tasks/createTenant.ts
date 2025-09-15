import { allCountries } from "@/data/countries";
import { getAirtableCountries } from "@/lib/airtable";
import { LANGUAGE_MAP } from "@/utils/locales";
import { TaskConfig } from "payload";
import { Tenant } from "@/payload-types";

type COUNTRY = NonNullable<Tenant["country"]>;

export const CreateTenantFromAirtable: TaskConfig<"createTenantFromAirtable"> =
  {
    slug: "createTenantFromAirtable",
    label: "Create Tenant From Airtable",
    handler: async ({ req: { payload } }) => {
      const { logger } = payload;
      logger.info(
        "createTenantFromAirtable:: Starting fetching countries from Airtable"
      );

      const {
        airtable: { airtableAPIKey, airtableBaseID },
      } = await payload.findGlobal({
        slug: "settings",
      });

      if (!airtableAPIKey || !airtableBaseID) {
        logger.error(
          "createTenantFromAirtable:: Airtable API Key and Base ID not configured"
        );
        throw new Error("Airtable API key or Base ID not found in settings");
      }

      try {
        const tenantCountries = await getAirtableCountries({
          airtableAPIKey,
          airtableID: airtableBaseID,
        });

        for (const country of tenantCountries) {
          const c = allCountries.find((t) => {
            return t.label["en"] === country.country;
          });

          if (c) {
            const { docs } = await payload.find({
              collection: "tenants",
              where: {
                country: {
                  like: c.value,
                },
              },
            });
            const tenant = docs[0];
            if (!tenant) {
              logger.info(
                `createTenantFromAirtable:: Tenant ${country.name} does not exist. Creating one....`
              );
              await payload.create({
                collection: "tenants",
                data: {
                  name: country.name!,
                  locale: LANGUAGE_MAP[country.language!],
                  country: c.value as COUNTRY,
                  airtableID: country.id,
                },
              });
            }
          }
        }
      } catch (error) {
        logger.error(
          "createTenantFromAirtable:: Error Fetching Document from AIrtable",
          { error }
        );
      }

      return {
        output: {},
      };
    },
  };
