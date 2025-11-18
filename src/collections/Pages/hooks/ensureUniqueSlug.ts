import { Page } from "@/payload-types";
import { FieldHook, ValidationError, Where } from "payload";

export const ensureUniqueSlug: FieldHook<Page> = async ({
  data,
  originalDoc,
  req,
  value,
}) => {
  if (originalDoc?.slug === value) {
    return value;
  }

  const constraints: Where[] = [
    {
      slug: {
        equals: value,
      },
    },
  ];

  if (data?.tenant) {
    constraints.push({
      tenant: {
        equals: data.tenant,
      },
    });
  }

  const { docs: duplicates } = await req.payload.find({
    collection: "pages",
    where: {
      and: constraints,
    },
  });
  if (duplicates.length > 0) {
    const { docs: tenant } = await req.payload.find({
      collection: "tenants",
      where: {
        id: {
          equals: data?.tenant,
        },
      },
    });
    throw new ValidationError({
      errors: [
        {
          message: `The ${tenant[0]?.name} tenant already has a page with the slug "${value}". Slugs must be unique per tenant`,
          path: "slug",
        },
      ],
    });
  }

  return value;
};

export const ensureUniqueGlobalPageSlug: FieldHook<Page> = async ({
  data,
  originalDoc,
  req,
  value,
}) => {
  if (originalDoc?.slug === value) {
    return value;
  }

  const constraints: Where[] = [
    {
      slug: {
        equals: value,
      },
    },
  ];

  if (data?.tenant) {
    constraints.push({
      tenant: {
        equals: data.tenant,
      },
    });
  }

  const { docs: duplicates } = await req.payload.find({
    collection: "global-pages",
    where: {
      and: constraints,
    },
  });
  if (duplicates.length > 0) {
    const { docs: tenant } = await req.payload.find({
      collection: "tenants",
      where: {
        id: {
          equals: data?.tenant,
        },
      },
    });
    throw new ValidationError({
      errors: [
        {
          message: `The ${tenant[0]?.name} tenant already has a page with the slug "${value}". Slugs must be unique per tenant`,
          path: "slug",
        },
      ],
    });
  }

  return value;
};
