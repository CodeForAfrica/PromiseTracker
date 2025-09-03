import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "users",
  labels: {
    singular: {
      en: "User",
      fr: "Utilisateur",
    },
    plural: {
      en: "Users",
      fr: "Utilisateurs",
    },
  },
  admin: {
    useAsTitle: "email",
    group: {
      en: "Settings",
      fr: "Paramètres",
    },
  },
  auth: true,
  fields: [],
};
