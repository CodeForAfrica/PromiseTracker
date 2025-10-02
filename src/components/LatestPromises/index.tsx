import LatestPromises from "./LatestPromises";

import { getGlobalPayload } from "@/lib/payload";

export default async function Index({
  entitySlug,
  title,
  seeAllLink = "View all promises",
}: {
  entitySlug: string;
  title: string;
  seeAllLink: string;
}) {
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
      politicalEntity: {
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

  const promises =
    docs?.map((promise) => {
      return {
        ...promise,
        href: `/${entity.slug}/promises/${promise.id}`,
      };
    }) ?? [];

  return (
    <LatestPromises
      title={title}
      actionLabel={seeAllLink}
      items={promises}
      promisePageLink={`/${entity.slug}/promises`}
    />
  );
}
