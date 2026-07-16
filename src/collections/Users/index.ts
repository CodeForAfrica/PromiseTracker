import {
  authenticated,
  shouldHideFromNonSuperAdmins,
  superAdminFieldAccess,
  superAdmins,
  superAdminsOrSelf,
} from "@/access/roles";
import type { CollectionConfig } from "payload";
import { assignInitialRole } from "./hooks";

export const Users: CollectionConfig = {
  slug: "users",
  access: {
    admin: authenticated,
    create: superAdmins,
    delete: superAdmins,
    read: superAdminsOrSelf,
    unlock: superAdmins,
    update: superAdminsOrSelf,
  },
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
    hidden: shouldHideFromNonSuperAdmins,
    group: {
      en: "Settings",
      fr: "Paramètres",
    },
  },
  auth: true,
  fields: [
    {
      name: "roles",
      type: "select",
      hasMany: true,
      required: true,
      defaultValue: ["globalEditor"],
      saveToJWT: true,
      access: {
        create: superAdminFieldAccess,
        read: superAdminFieldAccess,
        update: superAdminFieldAccess,
      },
      admin: {
        position: "sidebar",
      },
      label: {
        en: "Roles",
        fr: "Rôles",
      },
      options: [
        {
          label: {
            en: "Super administrator",
            fr: "Super administrateur",
          },
          value: "superAdmin",
        },
        {
          label: {
            en: "Global editor",
            fr: "Éditeur global",
          },
          value: "globalEditor",
        },
      ],
    },
  ],
  hooks: {
    beforeValidate: [assignInitialRole],
  },
};
