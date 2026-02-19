import { allCountries } from "@/data/countries";
import { getAirtableCountries } from "@/lib/airtable";
import { LANGUAGE_MAP } from "@/utils/locales";
import { TaskConfig } from "payload";
import { Tenant } from "@/payload-types";
import { getTaskLogger, withTaskTracing } from "./utils";

type COUNTRY = NonNullable<Tenant["country"]>;

export const CreateTenantFromAirtable: TaskConfig<"createTenantFromAirtable"> =
  {
    slug: "createTenantFromAirtable",
    label: "Create Tenant From Airtable",
    handler: withTaskTracing(
      "createTenantFromAirtable",
      async ({ req, input }) => {
        const { payload } = req;
        const logger = getTaskLogger(req, "createTenantFromAirtable", input);
        logger.info(
          "createTenantFromAirtable:: Starting fetching countries from Airtable",
        );

        const {
          airtable: { airtableAPIKey, airtableBaseID },
        } = await payload.findGlobal({
          slug: "settings",
        });

        if (!airtableAPIKey || !airtableBaseID) {
          logger.error(
            "createTenantFromAirtable:: Airtable API Key and Base ID not configured",
          );
          throw new Error("Airtable API key or Base ID not found in settings");
        }

        try {
          const tenantCountries = await getAirtableCountries({
            airtableAPIKey,
            airtableID: airtableBaseID,
          });

          let createdTenants = 0;
          let updatedTenants = 0;
          let failedTenants = 0;

          for (const country of tenantCountries) {
            try {
              const c = allCountries.find((t) => {
                return t.label["en"] === country.country;
              });

              if (!c) {
                logger.warn({
                  message:
                    "createTenantFromAirtable:: Skipping country with no local mapping",
                  airtableCountryId: country.id,
                  airtableCountryName: country.countryName,
                  airtableCountryLabel: country.country,
                  airtableLanguage: country.language,
                });
                continue;
              }

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
                  `createTenantFromAirtable:: Tenant ${country.countryName} does not exist. Creating one....`,
                );
                await payload.create({
                  collection: "tenants",
                  data: {
                    name: country.countryName!,
                    locale: LANGUAGE_MAP[country.language!],
                    country: c.value as COUNTRY,
                    publish: Boolean(country.publishThisCountry),
                    airtableID: country.id,
                  },
                });
                createdTenants += 1;
              } else {
                const shouldPublish = Boolean(country.publishThisCountry);

                if (Boolean(tenant.publish) !== shouldPublish) {
                  await payload.update({
                    collection: "tenants",
                    id: tenant.id,
                    data: {
                      publish: shouldPublish,
                    },
                  });

                  logger.info({
                    message:
                      "createTenantFromAirtable:: Updated tenant publish status",
                    tenantId: tenant.id,
                    tenantName: tenant.name,
                    tenantCountry: tenant.country,
                    publish: shouldPublish,
                    airtableCountryId: country.id,
                  });
                  updatedTenants += 1;
                }
              }
            } catch (countryError) {
              failedTenants += 1;
              logger.error({
                message:
                  "createTenantFromAirtable:: Failed processing Airtable country",
                airtableCountryId: country.id,
                airtableCountryName: country.countryName,
                airtableCountryLabel: country.country,
                airtableLanguage: country.language,
                error:
                  countryError instanceof Error
                    ? countryError.message
                    : String(countryError ?? ""),
              });
            }
          }

          logger.info({
            message: "createTenantFromAirtable:: Country sync completed",
            totalCountries: tenantCountries.length,
            createdTenants,
            updatedTenants,
            failedTenants,
          });
        } catch (error) {
          logger.error({
            message:
              "createTenantFromAirtable:: Error fetching countries from Airtable",
            airtableBaseID,
            error: error instanceof Error ? error.message : String(error ?? ""),
          });
        }

        return {
          output: {},
        };
      },
    ),
  };
