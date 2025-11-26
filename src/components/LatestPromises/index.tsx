import LatestPromises from "./LatestPromises";
import { LatestPromisesBlock } from "@/payload-types";

import { getGlobalPayload } from "@/lib/payload";
import { getPromiseUpdateEmbed } from "@/lib/data/promiseUpdates";
import { getTenantBySubDomain } from "@/lib/data/tenants";
import { getDomain } from "@/lib/domain";
import { resolveTenantLocale } from "@/utils/locales";
import { resolveBrowserLocale } from "@/app/(frontend)/layout";

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
  const { subdomain } = await getDomain();
  const tenant = await getTenantBySubDomain(subdomain);
  const locale = tenant
    ? resolveTenantLocale(tenant)
    : await resolveBrowserLocale();

  const entityQuery = await payload.find({
    collection: "political-entities",
    where: {
      slug: {
        equals: entitySlug,
      },
    },
    limit: 1,
    depth: 2,
    locale,
  });

  const entity = entityQuery.docs[0];

  if (!entity) {
    return null;
  }
  const { docs } = await payload.find({
    collection: "promises",
    where: {
      and: [
        {
          politicalEntity: {
            equals: entity.id,
          },
        },
        {
          publishStatus: {
            equals: "published",
          },
        },
      ],
    },
    depth: 2,
    limit: 3,
    sort: "-createdAt",
    locale,
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

  const promiseUpdateSettings = await getPromiseUpdateEmbed(locale);
  const fallbackImage = promiseUpdateSettings?.defaultImage ?? null;

  return (
    <LatestPromises
      title={title}
      items={promises}
      seeAll={seeAllLink}
      fallbackImage={fallbackImage}
      entitySlug={entitySlug}
    />
  );
}
