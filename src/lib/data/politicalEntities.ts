import { getGlobalPayload } from "@/lib/payload";
import type {
  PoliticalEntity,
  Tenant,
  Promise as PromiseDoc,
} from "@/payload-types";
import type { PayloadLocale } from "@/utils/locales";

const payload = await getGlobalPayload();

export const getPoliticalEntitiesByTenant = async (
  tenant: Tenant,
  locale?: PayloadLocale,
): Promise<PoliticalEntity[]> => {
  const { docs } = await payload.find({
    collection: "political-entities",
    limit: -1,
    depth: 2,
    sort: "name",
    ...(locale ? { locale } : {}),
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
  slug: string,
  locale?: PayloadLocale,
): Promise<PoliticalEntity | undefined> => {
  const { docs } = await payload.find({
    collection: "political-entities",
    limit: 1,
    depth: 2,
    ...(locale ? { locale } : {}),
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
  entityIds: string[],
): Promise<
  Record<
    string,
    {
      total: number;
      statuses: Record<string, number>;
    }
  >
> => {
  if (entityIds.length === 0) {
    return {};
  }

  const counts = entityIds.reduce<
    Record<
      string,
      {
        total: number;
        statuses: Record<string, number>;
      }
    >
  >((acc, id) => {
    acc[id] = {
      total: 0,
      statuses: {},
    };
    return acc;
  }, {});

  const { docs: promises } = await payload.find({
    collection: "promises",
    limit: -1,
    depth: 1,
    select: {
      politicalEntity: true,
      status: true,
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
      typeof relation === "string" ? relation : (relation?.id ?? null);
    if (!entityId) {
      continue;
    }

    const summary =
      counts[entityId] ??
      {
        total: 0,
        statuses: {},
      };

    const statusValue = promise.status;
    const statusId =
      typeof statusValue === "string"
        ? statusValue
        : statusValue?.id ?? statusValue?.meedanId ?? null;

    if (statusId) {
      summary.statuses[statusId] = (summary.statuses[statusId] ?? 0) + 1;
    }

    summary.total += 1;
    counts[entityId] = summary;
  }

  return counts;
};
