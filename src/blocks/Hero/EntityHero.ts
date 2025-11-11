import { Block } from "payload";

export const EntityHero: Block = {
  slug: "entity-hero",
  imageURL: "/cms/entity-hero.png",
  interfaceName: "EntityHeroBlock",
  imageAltText: "Entity Hero",
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
  ],
};
