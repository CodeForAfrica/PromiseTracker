import { getGlobalPayload } from "@/lib/payload";
import Promises from "./Promises";
import { slugify } from "@/utils/utils";
import { PromiseListBlock } from "@/payload-types";

export type PromiseListProps = PromiseListBlock & {
  entitySlug?: string;
};

async function Index(props: PromiseListProps) {
  const { title, filterBy, sortBy, filterByLabel, sortByLabel, entitySlug } =
    props;
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

  const promiseStatusesMap = new Map<string, { slug: string; name: string }>();

  promises.forEach((promise) => {
    const statusLabel =
      typeof promise?.status === "object" && promise?.status !== null
        ? promise.status.label ?? ""
        : (promise.status as string) ?? "";

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
    />
  );
}

export default Index;
