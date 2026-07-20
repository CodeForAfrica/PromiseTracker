import LatestPromises from "./LatestPromises";
import { LatestPromisesBlock, PoliticalEntity } from "@/payload-types";

import { getGlobalPayload } from "@/lib/payload";
import { getPromiseUpdateEmbed } from "@/lib/data/promiseUpdates";
import { getPoliticalEntityBySlug } from "@/lib/data/politicalEntities";
import { buildPublishedPromisesQuery } from "@/lib/data/promiseQueries";
import { getTenantBySubDomain } from "@/lib/data/tenants";
import { getDomain } from "@/lib/domain";
import { resolveEntityLocale, resolveTenantLocale } from "@/utils/locales";

export type LatestPromisesProps = LatestPromisesBlock & {
  entitySlug: string;
  entity?: PoliticalEntity;
};

export default async function Index({
  entitySlug,
  entity: resolvedEntity,
  title,
  seeAllLink,
}: LatestPromisesProps) {
  if (!resolvedEntity && !entitySlug) {
    return null;
  }
  const payload = await getGlobalPayload();

  // Prefer the entity the route already resolved — never re-resolve by slug
  // alone, since slugs are only unique per tenant.
  let entity = resolvedEntity;
  if (!entity) {
    const { subdomain } = await getDomain();
    const tenant = await getTenantBySubDomain(subdomain);
    if (!tenant) {
      return null;
    }
    entity = await getPoliticalEntityBySlug(
      tenant,
      entitySlug,
      resolveTenantLocale(tenant),
    );
  }

  if (!entity) {
    return null;
  }
  const locale = resolveEntityLocale(entity);
  const { docs } = await payload.find(
    buildPublishedPromisesQuery(entity.id, { limit: 3, locale }),
  );

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
