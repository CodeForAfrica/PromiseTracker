import { superAdminFieldAccess } from "@/access/roles";
import type { FieldHook, TextField } from "payload";

export const ENCRYPTED_SECRET_PREFIX = "enc:v1:";
export const REDACTED_SECRET_VALUE = "********";

export const isEncryptedSecret = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith(ENCRYPTED_SECRET_PREFIX);

export const encryptSecretValue: FieldHook = ({
  previousValue,
  req,
  value,
}) => {
  if (value === REDACTED_SECRET_VALUE) {
    return previousValue;
  }

  if (typeof value !== "string" || value.length === 0) {
    return value;
  }

  if (isEncryptedSecret(value)) {
    return value;
  }

  return `${ENCRYPTED_SECRET_PREFIX}${req.payload.encrypt(value)}`;
};

export const readSecretValue: FieldHook = ({ req, value }) => {
  if (typeof value !== "string" || value.length === 0) {
    return value;
  }

  if (req.payloadAPI !== "local") {
    return REDACTED_SECRET_VALUE;
  }

  if (!isEncryptedSecret(value)) {
    // Supports existing plaintext values until the data migration is applied.
    return value;
  }

  return req.payload.decrypt(value.slice(ENCRYPTED_SECRET_PREFIX.length));
};

type SingleTextField = Extract<TextField, { hasMany?: false | undefined }>;

export const encryptedSecretField = (
  field: Omit<SingleTextField, "hooks" | "type"> & {
    hooks?: SingleTextField["hooks"];
  },
): TextField => ({
  ...field,
  type: "text",
  access: {
    ...field.access,
    create: superAdminFieldAccess,
    read: superAdminFieldAccess,
    update: superAdminFieldAccess,
  },
  hooks: {
    ...field.hooks,
    afterRead: [...(field.hooks?.afterRead ?? []), readSecretValue],
    beforeChange: [...(field.hooks?.beforeChange ?? []), encryptSecretValue],
  },
});
