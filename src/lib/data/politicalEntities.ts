import { getGlobalPayload } from "@/lib/payload";
import type { PoliticalEntity, Tenant } from "@/payload-types";

const payload = await getGlobalPayload();

export const getPoliticalEntitiesByTenant = async (
  tenant: Tenant
): Promise<PoliticalEntity[]> => {
  const { docs } = await payload.find({
    collection: "political-entities",
    limit: -1,
    depth: 2,
    sort: "name",
    where: {
      tenant: {
        equals: tenant,
      },
    },
  });

  return docs;
};

export const getPoliticalEntityBySlug = async (
  tenant: Tenant,
  slug: string
): Promise<PoliticalEntity | undefined> => {
  const { docs } = await payload.find({
    collection: "political-entities",
    limit: 1,
    depth: 2,
    where: {
      and: [
        {
          tenant: {
            equals: tenant,
          },
        },
        {
          slug: {
            equals: slug,
          },
        },
      ],
    },
  });

  return docs[0];
};

export const getExtractionCountsForEntities = async (
  entityIds: string[]
): Promise<Record<string, number>> => {
  if (entityIds.length === 0) {
    return {};
  }

  const { docs: documents } = await payload.find({
    collection: "documents",
    depth: 0,
    limit: -1,
    select: {
      id: true,
      politicalEntity: true,
    },
    where: {
      politicalEntity: {
        in: entityIds,
      },
    },
  });

  const docToEntity = new Map<string, string>();
  const documentIds: string[] = [];

  for (const doc of documents) {
    const entityRelation = doc.politicalEntity;
    const entityId =
      typeof entityRelation === "string" ? entityRelation : entityRelation?.id;
    if (!entityId) continue;
    docToEntity.set(doc.id, entityId);
    documentIds.push(doc.id);
  }

  if (documentIds.length === 0) {
    return entityIds.reduce<Record<string, number>>((acc, id) => {
      acc[id] = 0;
      return acc;
    }, {});
  }

  const { docs: promises } = await payload.find({
    collection: "promises",
    depth: 0,
    limit: -1,
    select: {
      document: true,
      extractions: true,
    },
    where: {
      document: {
        in: documentIds,
      },
    },
  });

  const counts = entityIds.reduce<Record<string, number>>((acc, id) => {
    acc[id] = 0;
    return acc;
  }, {});

  for (const promise of promises) {
    const relation = promise.document;
    const documentId = typeof relation === "string" ? relation : relation?.id;
    if (!documentId) continue;
    const entityId = docToEntity.get(documentId);
    if (!entityId) continue;
    const extractionsCount = Array.isArray(promise.extractions)
      ? promise.extractions.length
      : 0;
    if (extractionsCount === 0) continue;
    counts[entityId] = (counts[entityId] ?? 0) + extractionsCount;
  }

  return counts;
};
