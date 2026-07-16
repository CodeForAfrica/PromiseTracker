import { CollectionBeforeValidateHook } from "payload";

export const assignInitialRole: CollectionBeforeValidateHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation !== "create") {
    return data;
  }

  const { totalDocs } = await req.payload.count({
    collection: "users",
    overrideAccess: true,
    req,
  });

  if (totalDocs === 0) {
    return {
      ...data,
      roles: ["superAdmin"],
    };
  }

  return {
    ...data,
    roles:
      Array.isArray(data?.roles) && data.roles.length > 0
        ? data.roles
        : ["globalEditor"],
  };
};
