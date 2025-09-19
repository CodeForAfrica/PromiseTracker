import LatestPromises from "./LatestPromises";

import { getGlobalPayload } from "@/lib/payload";

export default async function Index({ entitySlug }: { entitySlug?: string }) {
  if (!entitySlug) {
    return null;
  }
  const payload = await getGlobalPayload();

  const entityQuery = await payload.find({
    collection: "political-entities",
    where: {
      slug: {
        equals: entitySlug,
      },
    },
    limit: 1,
    depth: 2,
  });

  const entity = entityQuery.docs[0];

  if (!entity) {
    return null;
  }
  const { docs } = await payload.find({
    collection: "promises",
    where: {
      "document.politicalEntity": {
        equals: entity.id,
      },
    },
    depth: 2,
    limit: 3,
    sort: "-createdAt",
  });

  if (!docs || docs.length === 0) {
    return null;
  }

  const [{ extractions }] = docs;

  const promises =
    extractions?.map((extraction) => {
      return {
        title: extraction.summary,
        status: {
          title: "Unknown",
          label: "unknown",
          color: "rgb(255, 179, 34)",
        },
        href: `/promises/`,
        image: {
          url: "https://dashboard.hurumap.org/promisetracker/wp-content/uploads/sites/2/2021/08/adeboro-odunlami-bJgTryACMF0-unsplash.jpg",
          alt: extraction.summary,
        },
        description: extraction.source,
      };
    }) ?? [];

  return (
    <LatestPromises
      title="Latest Promises"
      actionLabel="View all promises"
      items={promises}
    />
  );
}
