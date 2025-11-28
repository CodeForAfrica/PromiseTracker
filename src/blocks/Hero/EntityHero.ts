import { Block } from "payload";

export const EntityHero: Block = {
  slug: "entity-hero",
  imageURL: "/cms/entity-hero.png",
  interfaceName: "EntityHeroBlock",
  imageAltText: "Tenant Hero",
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "description",
      type: "textarea",
      required: true,
      localized: true,
    },
    {
      name: "carousel",
      type: "array",
      required: true,
      minRows: 1,
      fields: [
        {
          name: "carouselItems",
          type: "group",
          fields: [
            {
              name: "images",
              type: "upload",
              relationTo: "media",
              hasMany: true,
              minRows: 1,
            },
            {
              name: "tenant",
              type: "relationship",
              relationTo: "tenants",
            },
          ],
        },
      ],
      validate: (value: any) => {
        const tenants = value.map(
          ({ carouselItems }: { carouselItems: { tenant: string } }) =>
            carouselItems.tenant
        );
        const tenantCounts = tenants.reduce(
          (acc: Record<string, number>, tenant: string) => {
            acc[tenant] = (acc[tenant] || 0) + 1;
            return acc;
          },
          {}
        );
        const duplicateTenants = Object.entries(tenantCounts)
          .filter(([_, count]) => (count as number) > 1)
          .map(([tenant]) => tenant);
        if (duplicateTenants.length > 0) {
          return `Duplicate tenants found. There should be only one tenant per carousel item.`;
        }
        return true;
      },
    },
  ],
};
