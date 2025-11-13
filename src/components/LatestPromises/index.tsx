import LatestPromises from "./LatestPromises";
import { LatestPromisesBlock } from "@/payload-types";

import { getGlobalPayload } from "@/lib/payload";
import { getPromiseUpdateEmbed } from "@/lib/data/promiseUpdates";

export type LatestPromisesProps = LatestPromisesBlock & {
  entitySlug: string;
};

export default async function Index({
  entitySlug,
  title,
  seeAllLink,
}: LatestPromisesProps) {
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

  const promiseUpdateSettings = await getPromiseUpdateEmbed();
  const fallbackImage = promiseUpdateSettings?.defaultImage ?? null;

  return (
    <LatestPromises
      title={title}
      items={promises}
      seeAll={seeAllLink}
      fallbackImage={fallbackImage}
    />
  );
}
