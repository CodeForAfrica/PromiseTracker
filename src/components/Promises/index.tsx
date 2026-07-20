import { getGlobalPayload } from "@/lib/payload";
import Promises from "./Promises";
import { slugify } from "@/utils/utils";
import { PoliticalEntity, PromiseListBlock } from "@/payload-types";
import { resolveEntityLocale } from "@/utils/locales";
import { getPromiseUpdateEmbed } from "@/lib/data/promiseUpdates";
import { getPoliticalEntityBySlug } from "@/lib/data/politicalEntities";
import { buildPublishedPromisesQuery } from "@/lib/data/promiseQueries";
import { getTenantBySubDomain } from "@/lib/data/tenants";
import { getDomain } from "@/lib/domain";

export type PromiseListProps = PromiseListBlock & {
  entitySlug?: string;
  entity?: PoliticalEntity;
};

const resolveEntity = async (
  entity: PoliticalEntity | undefined,
  entitySlug: string | undefined,
): Promise<PoliticalEntity | undefined> => {
  // Prefer the entity the route already resolved — never re-resolve by slug
  // alone, since slugs are only unique per tenant.
  if (entity) {
    return entity;
  }

  if (!entitySlug) {
    return undefined;
  }

  const { subdomain } = await getDomain();
  const tenant = await getTenantBySubDomain(subdomain);
  if (!tenant) {
    return undefined;
  }

  return getPoliticalEntityBySlug(tenant, entitySlug);
};

async function Index(props: PromiseListProps) {
  const { title, filterBy, sortBy, filterByLabel, sortByLabel, entitySlug } =
    props;
  const payload = await getGlobalPayload();

  const entity = await resolveEntity(props.entity, entitySlug);

  if (!entity) {
    return null;
  }
  const locale = resolveEntityLocale(entity);
  const promiseUpdateSettings = await getPromiseUpdateEmbed();
  const fallbackImage = promiseUpdateSettings?.defaultImage ?? null;

  // Deliberately unpaginated: the main promise list renders every published
  // promise for the entity (client-side filtering handles navigation).
  const { docs } = await payload.find(
    buildPublishedPromisesQuery(entity.id, { locale }),
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

  const promiseStatusesMap = new Map<string, { slug: string; name: string }>();

  promises.forEach((promise) => {
    const statusLabel =
      typeof promise?.status === "object" && promise?.status !== null
        ? (promise.status.label ?? "")
        : ((promise.status as string) ?? "");

    const slug = slugify(statusLabel);

    if (!slug || promiseStatusesMap.has(slug)) {
      return;
    }

    promiseStatusesMap.set(slug, {
      slug,
      name: statusLabel,
    });
  });

  const promiseStatuses = Array.from(promiseStatusesMap.values());
  const entityImage =
    typeof entity.image === "string" ? null : (entity.image ?? null);
  const filterByOptions = {
    label: filterByLabel ?? "",
    items:
      filterBy?.map((filter: string) => ({
        name: filter,
        slug: filter,
      })) ?? [],
  };
  const sortByOptions = {
    label: sortByLabel ?? "",
    items:
      sortBy?.map((sort: string) => ({
        name: sort,
        slug: sort,
      })) ?? [],
  };
  return (
    <Promises
      title={title!}
      items={promises}
      withFilter={!!sortBy?.length}
      filterByConfig={filterByOptions}
      sortByConfig={sortByOptions}
      promiseStatuses={promiseStatuses}
      entity={{ name: entity.name, slug: entity.slug, image: entityImage }}
      fallbackImage={fallbackImage}
    />
  );
}

export default Index;
