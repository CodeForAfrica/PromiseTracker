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

  const [{ docs: promises }, { docs: statusDocs }] = await Promise.all([
    payload.find({
      collection: "promises",
      pagination: false,
      depth: 1,
      select: {
        politicalEntity: true,
        status: true,
        publishStatus: true,
      },
      where: {
        politicalEntity: {
          in: entityIds,
        },
      },
    }),
    payload.find({
      collection: "promise-status",
      pagination: false,
      depth: 0,
    }),
  ]);

  const statusIdByMeedanId = new Map<string, string>();
  for (const status of statusDocs) {
    if (!status) continue;
    const meedanId =
      typeof status.meedanId === "string" ? status.meedanId.trim() : "";
    if (meedanId) {
      statusIdByMeedanId.set(meedanId, status.id);
    }
  }

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
    let statusId =
      typeof statusValue === "string"
        ? statusValue
        : statusValue?.id ?? statusValue?.meedanId ?? null;

    if (!statusId) {
      const publishStatus =
        typeof promise.publishStatus === "string"
          ? promise.publishStatus.trim()
          : "";
      if (publishStatus) {
        statusId = statusIdByMeedanId.get(publishStatus) ?? null;
      }
    }

    if (statusId) {
      summary.statuses[statusId] = (summary.statuses[statusId] ?? 0) + 1;
    }

    summary.total += 1;
    counts[entityId] = summary;
  }

  return counts;
};
