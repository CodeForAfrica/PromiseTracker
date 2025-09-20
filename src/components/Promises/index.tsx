// Create a component that renders a Promises Component

import { getGlobalPayload } from "@/lib/payload";
import Promises from "./Promises";
import { slugify } from "@/utils/utils";

interface Props {
  title?: string;
  filterBy?: string[];
  sortBy?: string[];
  filterByLabel?: string;
  sortByLabel?: string;
  entitySlug?: string;
}
async function Index({
  title,
  filterBy,
  sortBy,
  filterByLabel,
  sortByLabel,
  entitySlug,
}: Props) {
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
        href: `/promises/${promise.id}`,
      };
    }) ?? [];

  const promiseStatuses = [
    ...new Set(
      promises.map((promise) => {
        if (typeof promise?.status === "object" && promise?.status !== null) {
          return {
            slug: slugify(promise.status.label ?? ""),
            name: promise.status.label ?? "",
          };
        }
        return {
          slug: slugify(promise.status ?? ""),
          name: promise.status ?? "",
        };
      }),
    ),
  ];
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
  // Get all promises per entity
  return (
    <Promises
      title={title}
      items={promises}
      withFilter={!!sortBy?.length}
      filterByConfig={filterByOptions}
      sortByConfig={sortByOptions}
      promiseStatuses={promiseStatuses}
    />
  );
}

export default Index;
