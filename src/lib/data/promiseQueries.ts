import type { Where } from "payload";

type PublishedPromisesQueryOptions = {
  /**
   * Maximum number of records to return. When omitted, pagination is
   * deliberately disabled so lists render every published promise for the
   * entity rather than silently truncating at Payload's default page size.
   */
  limit?: number;
  locale?: "en" | "fr";
};

export const buildPublishedPromisesQuery = (
  entityId: string,
  { limit, locale }: PublishedPromisesQueryOptions = {},
) => {
  const where: Where = {
    and: [
      {
        politicalEntity: {
          equals: entityId,
        },
      },
      {
        publishStatus: {
          equals: "published",
        },
      },
    ],
  };

  return {
    collection: "promises" as const,
    where,
    depth: 2,
    sort: "-createdAt",
    ...(typeof limit === "number" ? { limit } : { pagination: false }),
    ...(locale ? { locale } : {}),
  };
};
