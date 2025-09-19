import { getGlobalPayload } from "@/lib/payload";
import type {
  PoliticalEntity,
  Tenant,
  Promise as PromiseDoc,
} from "@/payload-types";

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

export const getPromiseCountsForEntities = async (
  entityIds: string[]
): Promise<Record<string, number>> => {
  if (entityIds.length === 0) {
    return {};
  }

  const counts = entityIds.reduce<Record<string, number>>((acc, id) => {
    acc[id] = 0;
    return acc;
  }, {});

  const { docs: promises } = await payload.find({
    collection: "promises",
    limit: -1,
    depth: 0,
    select: {
      politicalEntity: true,
    },
    where: {
      politicalEntity: {
        in: entityIds,
      },
    },
  });

  for (const promise of promises as PromiseDoc[]) {
    const relation = promise.politicalEntity;
    const entityId =
      typeof relation === "string" ? relation : relation?.id ?? null;
    if (!entityId) {
      continue;
    }

    counts[entityId] = (counts[entityId] ?? 0) + 1;
  }

  return counts;
};
