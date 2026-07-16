import type { Access, CollectionConfig, FieldAccess } from "payload";
import { User } from "@/payload-types";

export const USER_ROLES = ["superAdmin", "globalEditor"] as const;

export type UserRole = (typeof USER_ROLES)[number];

type CollectionAdminAccess = NonNullable<
  NonNullable<CollectionConfig["access"]>["admin"]
>;

type CollectionHidden = Exclude<
  NonNullable<CollectionConfig["admin"]>["hidden"],
  boolean | undefined
>;

export const isSuperAdmin = (
  user: Pick<User, "roles"> | null | undefined,
): boolean => Boolean(user?.roles?.includes("superAdmin"));

export const authenticated: CollectionAdminAccess = ({ req }) =>
  Boolean(req.user);

export const authenticatedUsers: Access = ({ req }) => Boolean(req.user);

export const authenticatedFieldAccess: FieldAccess = ({ req }) =>
  Boolean(req.user);

export const superAdmins: Access = ({ req }) => isSuperAdmin(req.user);

export const superAdminsOrSelf: Access = ({ req }) => {
  if (isSuperAdmin(req.user)) {
    return true;
  }

  if (req.user) {
    return {
      id: {
        equals: req.user.id,
      },
    };
  }

  return false;
};

export const superAdminFieldAccess: FieldAccess = ({ req }) =>
  isSuperAdmin(req.user);

export const shouldHideFromNonSuperAdmins: CollectionHidden = ({ user }) =>
  !isSuperAdmin({ roles: user.roles });
