import { allCountries } from "@/data/countries";
import { toDate, formatISO } from "date-fns";
import {
  getAirtableCountries,
  getAirtablePoliticalEntities,
  getDocumentsByIds,
} from "@/lib/airtable";
import { TaskConfig } from "payload";
import { downloadFile } from "@/utils/files";
import { unlink } from "node:fs/promises";
import { formatSlug } from "@/fields/slug/formatSlug";
import type { Media } from "@/payload-types";

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

      if (!entities.length) {
        logger.info("createPoliticalEntity:: No political entities returned");
        return { output: {} };
      }

      const countries = await getAirtableCountries({
        airtableAPIKey,
        airtableID: airtableBaseID,
      });

      const countriesById = new Map(
        countries.map((country) => [country.id, country])
      );

      const countryCodeByLabel = new Map(
        allCountries.map((entry) => [entry.label["en"], entry.value])
      );

      const { docs: existingEntities } = await payload.find({
        collection: "political-entities",
        limit: -1,
        depth: 1,
      });

      const existingByAirtable = new Map(
        existingEntities
          .filter((entity) => entity.airtableID)
          .map((entity) => [entity.airtableID as string, entity])
      );

      const existingByName = new Map(
        existingEntities.map((entity) => [entity.name.toLowerCase(), entity])
      );

      const collectDocIds = new Set<string>();
      entities.forEach((entity) => {
        (entity.documents || []).forEach((docId) => {
          if (docId) {
            collectDocIds.add(docId);
          }
        });
      });

      const airtableDocuments = collectDocIds.size
        ? await getDocumentsByIds({
            airtableAPIKey,
            ids: Array.from(collectDocIds),
          })
        : [];
      const airtableDocumentsById = new Map(
        airtableDocuments.map((doc) => [doc.id, doc])
      );

      const existingDocuments = collectDocIds.size
        ? await payload.find({
            collection: "documents",
            where: {
              airtableID: {
                in: Array.from(collectDocIds),
              },
            },
            limit: -1,
            depth: 1,
          })
        : { docs: [] };

      const existingDocsById = new Map(
        existingDocuments.docs
          .filter((doc) => doc.airtableID)
          .map((doc) => [doc.airtableID as string, doc])
      );
      const processedDocIds = new Set<string>();

      const normalize = (value?: string | null) => (value ?? "").trim();

      const ensureDocumentFreshness = async (docId: string) => {
        if (!docId || processedDocIds.has(docId)) {
          return;
        }
        processedDocIds.add(docId);

        const airtableDoc = airtableDocumentsById.get(docId);
        const existingDoc = existingDocsById.get(docId);

        if (!airtableDoc || !existingDoc) {
          return;
        }

        const hasFiles = Array.isArray(existingDoc.files)
          ? existingDoc.files.length > 0
          : Boolean(existingDoc.files);

        if (hasFiles) {
          return;
        }

        const newDocURLs = (airtableDoc.documents || []).map((url) => ({
          url,
        }));
        const existingDocURLs = (existingDoc.docURLs || [])
          .map((entry) => entry?.url)
          .filter(Boolean) as string[];

        const docUrlsChanged =
          newDocURLs.length !== existingDocURLs.length ||
          newDocURLs.some(
            (entry, index) => entry.url !== existingDocURLs[index]
          );

        const newUrl = normalize(airtableDoc.uRL);
        const existingUrl = normalize(existingDoc.url);

        if (!docUrlsChanged && (!newUrl || newUrl === existingUrl)) {
          return;
        }

        const data: Record<string, unknown> = {};

        if (docUrlsChanged) {
          data.docURLs = newDocURLs;
        }

        if (newUrl && newUrl !== existingUrl) {
          data.url = newUrl;
        }

        if (Object.keys(data).length === 0) {
          return;
        }

        const updatedDoc = await payload.update({
          collection: "documents",
          id: existingDoc.id,
          data,
        });

        existingDocsById.set(docId, updatedDoc);
      };

      const mediaExternalUrlCache = new Map<string, string>();

      const getMediaExternalUrl = async (
        imageRef: string | Media | null | undefined
      ): Promise<string> => {
        if (!imageRef) {
          return "";
        }

        if (typeof imageRef === "string") {
          if (mediaExternalUrlCache.has(imageRef)) {
            return mediaExternalUrlCache.get(imageRef) as string;
          }

          try {
            const media = await payload.findByID({
              collection: "media",
              id: imageRef,
            });
            const url = normalize((media as any)?.externalUrl);
            mediaExternalUrlCache.set(imageRef, url);
            return url;
          } catch (error) {
            logger.warn(
              "createPoliticalEntity:: Unable to resolve media external URL",
              { error, mediaId: imageRef }
            );
            return "";
          }
        }

        const mediaId = (imageRef as any)?.id;
        const url = normalize((imageRef as any)?.externalUrl);

        if (mediaId) {
          mediaExternalUrlCache.set(mediaId, url);
        }

        return url;
      };

      const { docs: tenantsForLookup } = await payload.find({
        collection: "tenants",
        limit: -1,
      });
      const tenantLookup = new Map(
        tenantsForLookup.map((tenant) => [tenant.country, tenant])
      );

      const toIsoDate = (timestamp?: number | null): string => {
        if (!timestamp) {
          return "";
        }
        return formatISO(toDate(timestamp * 1000));
      };

      const countryCache = new Map<string, any>();

      const getTenantForEntity = (entityCountryId?: string) => {
        if (!entityCountryId) {
          return undefined;
        }

        if (countryCache.has(entityCountryId)) {
          return countryCache.get(entityCountryId);
        }

        const countryRecord = countriesById.get(entityCountryId);
        const countryCode = countryRecord?.country
          ? countryCodeByLabel.get(countryRecord.country)
          : undefined;

        if (!countryCode) {
          countryCache.set(entityCountryId, undefined);
          return undefined;
        }

        // @ts-expect-error: Type 'string | string[]' is not assignable to type 'string'.
        const tenantForCountry = tenantLookup.get(countryCode);
        countryCache.set(entityCountryId, tenantForCountry);
        return tenantForCountry;
      };

      let createdCount = 0;
      let updatedCount = 0;

      for (const entity of entities) {
        if (!entity || !entity.name) {
          continue;
        }

        const tenantForEntity = getTenantForEntity(entity.country?.[0]);

        if (!tenantForEntity) {
          logger.warn(
            "createPoliticalEntity:: Tenant not found for entity country",
            { entityId: entity.id, country: entity.country }
          );
          continue;
        }

        const imageUrl = entity.image?.[0];
        if (!imageUrl) {
          logger.warn("createPoliticalEntity:: Skipping entity without image", {
            entityId: entity.id,
          });
          continue;
        }

        let existingEntity =
          existingByAirtable.get(entity.id) ||
          existingByName.get(entity.name.toLowerCase());

        const periodFrom = toIsoDate(entity.periodFrom);
        const periodTo = toIsoDate(entity.periodTo);
        const position =
          entity.title?.trim() || (existingEntity?.position ?? "Unknown");

        if (!periodFrom || !periodTo) {
          logger.warn(
            "createPoliticalEntity:: Skipping entity without valid term dates",
            { entityId: entity.id }
          );
          continue;
        }

        if (!existingEntity) {
          const filePath = await downloadFile(imageUrl);
          const mediaUpload = await payload.create({
            collection: "media",
            data: {
              alt: entity.name || "",
              externalUrl: imageUrl,
            },
            filePath,
          });
          await unlink(filePath);

          const mediaId = (mediaUpload as any)?.id ?? mediaUpload;

          const createdEntity = await payload.create({
            collection: "political-entities",
            data: {
              tenant: tenantForEntity.id,
              name: entity.name,
              periodFrom,
              periodTo,
              position,
              image: mediaId,
              region: entity.region,
              airtableID: entity.id,
              slug: formatSlug(entity.name),
            },
          });

          existingByAirtable.set(entity.id, createdEntity);
          existingByName.set(createdEntity.name.toLowerCase(), createdEntity);
          createdCount += 1;
          existingEntity = createdEntity;
        } else {
          const updateData: Record<string, unknown> = {};

          if (existingEntity.name !== entity.name) {
            existingByName.delete(existingEntity.name.toLowerCase());
            updateData.name = entity.name;
            if (existingEntity.slugLock !== true) {
              updateData.slug = formatSlug(entity.name);
            }
          }

          const currentRegion = existingEntity.region || "";
          if (currentRegion !== (entity.region || "")) {
            updateData.region = entity.region;
          }

          if (existingEntity.position !== position) {
            updateData.position = position;
          }

          if (periodFrom && existingEntity.periodFrom !== periodFrom) {
            updateData.periodFrom = periodFrom;
          }

          if (periodTo && existingEntity.periodTo !== periodTo) {
            updateData.periodTo = periodTo;
          }

          const existingTenantId =
            typeof existingEntity.tenant === "string"
              ? existingEntity.tenant
              : existingEntity.tenant?.id;

          if (existingTenantId !== tenantForEntity.id) {
            updateData.tenant = tenantForEntity.id;
          }

          if (existingEntity.airtableID !== entity.id) {
            updateData.airtableID = entity.id;
          }

          const existingExternalUrl = await getMediaExternalUrl(
            existingEntity.image
          );

          if (existingExternalUrl !== imageUrl) {
            const filePath = await downloadFile(imageUrl);
            const mediaUpload = await payload.create({
              collection: "media",
              data: {
                alt: entity.name || "",
                externalUrl: imageUrl,
              },
              filePath,
            });
            await unlink(filePath);
            updateData.image = (mediaUpload as any)?.id ?? mediaUpload;
          }

          if (Object.keys(updateData).length > 0) {
            const updatedEntity = await payload.update({
              collection: "political-entities",
              id: existingEntity.id,
              data: updateData,
            });

            existingByAirtable.set(entity.id, updatedEntity);
            existingByName.set(updatedEntity.name.toLowerCase(), updatedEntity);
            updatedCount += 1;
            existingEntity = updatedEntity;
          }
        }

        for (const docId of entity.documents || []) {
          await ensureDocumentFreshness(docId);
        }
      }

      logger.info("createPoliticalEntity:: Sync complete", {
        created: createdCount,
        updated: updatedCount,
        total: entities.length,
      });
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
