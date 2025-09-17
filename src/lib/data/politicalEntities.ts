import { getGlobalPayload } from "@/lib/payload";
import type { PoliticalEntity, Tenant } from "@/payload-types";

const payload = await getGlobalPayload();

export const getPoliticalEntitiesByTenant = async (
  tenant: Tenant,
): Promise<PoliticalEntity[]> => {
  const { docs } = await payload.find({
    collection: "political-entities",
    limit: -1,
    depth: 2,
    sort: "name",
    where: {
      tenant: {
        equals: tenant,
      },
    },
  });

  return docs;
};

export const getPoliticalEntityBySlug = async (
  tenant: Tenant,
  slug: string,
): Promise<PoliticalEntity | undefined> => {
  const { docs } = await payload.find({
    collection: "political-entities",
    limit: 1,
    depth: 2,
    where: {
      and: [
        {
          tenant: {
            equals: tenant,
          },
        },
        {
          slug: {
            equals: slug,
          },
        },
      ],
    },
  });

  return docs[0];
};
