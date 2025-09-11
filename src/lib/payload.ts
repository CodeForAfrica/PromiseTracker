import { BasePayload, getPayload } from "payload";
import config from "@/payload.config";
import { Tenant } from "@/payload-types";

export const getGlobalPayload = async (): Promise<BasePayload> => {
  const payloadConfig = await config;
  const payload = await getPayload({ config: payloadConfig });
  return payload;
};

export const queryPageBySlug = async ({
  slug,
  tenant,
}: {
  slug: string;
  tenant?: Tenant;
}) => {
  const payload = await getGlobalPayload();
  const { docs: pages } = await payload.find({
    collection: "pages",
    pagination: false,
    limit: 1,
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
    depth: 3,
  });

  return pages[0];
};
