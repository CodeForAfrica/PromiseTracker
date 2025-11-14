import { BasePayload, getPayload } from "payload";
import config from "@/payload.config";
import { Tenant } from "@/payload-types";
import type { PayloadLocale } from "@/utils/locales";

export const getGlobalPayload = async (): Promise<BasePayload> => {
  const payloadConfig = await config;
  const payload = await getPayload({ config: payloadConfig });
  return payload;
};

export const queryPageBySlug = async ({
  slug,
  tenant,
  locale,
}: {
  slug: string;
  tenant?: Tenant;
  locale?: PayloadLocale;
}) => {
  const payload = await getGlobalPayload();
  const { docs: pages } = await payload.find({
    collection: "pages",
    pagination: false,
    limit: 1,
    depth: 6,
    ...(locale ? { locale } : {}),
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

  return pages[0];
};

export const queryGlobalPageBySlug = async ({
  slug,
  locale,
}: {
  slug: string;
  locale?: PayloadLocale;
}) => {
  const payload = await getGlobalPayload();
  const { docs: pages } = await payload.find({
    collection: "global-pages",
    pagination: false,
    limit: 1,
    depth: 6,
    ...(locale ? { locale } : {}),
    where: {
      slug: {
        equals: slug,
      },
    },
  });

  return pages[0];
};
