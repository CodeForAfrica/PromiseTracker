// Create a component that renders a Promises Component

import Promises from "./Promises";

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
}: Props) {
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
      title={title}
      items={[]}
      withFilter={!!sortBy?.length}
      filterByConfig={filterByOptions}
      sortByConfig={sortByOptions}
    />
  );
}

export default Index;
