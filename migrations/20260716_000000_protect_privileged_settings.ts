import type {
  MigrateDownArgs,
  MigrateUpArgs,
  MongooseAdapter,
} from "@payloadcms/db-mongodb";
import type { Setting, User } from "../src/payload-types";
import {
  ENCRYPTED_SECRET_PREFIX,
  isEncryptedSecret,
} from "../src/fields/encryptedSecret";

// Raw documents predate this migration, so fields the current schema
// requires (roles, API keys) may still be missing.
type RawUser = Partial<Pick<User, "email" | "roles">>;

type RawSettings = {
  airtable?: Partial<Setting["airtable"]>;
  ai?: Partial<Pick<Setting["ai"], "apiKey" | "providerCredentials">>;
  meedan?: Partial<Setting["meedan"]>;
};

const encryptValue = (
  value: string | null | undefined,
  encrypt: (value: string) => string,
): string | null | undefined => {
  if (!value || isEncryptedSecret(value)) {
    return value;
  }

  return `${ENCRYPTED_SECRET_PREFIX}${encrypt(value)}`;
};

const decryptValue = (
  value: string | null | undefined,
  decrypt: (value: string) => string,
): string | null | undefined => {
  if (!isEncryptedSecret(value)) {
    return value;
  }

  return decrypt(value.slice(ENCRYPTED_SECRET_PREFIX.length));
};

const transformSettingsSecrets = (
  settings: RawSettings,
  transform: (value: string | null | undefined) => string | null | undefined,
) => {
  const providerCredentials = settings.ai?.providerCredentials?.map(
    (credential) => ({
      ...credential,
      apiKey: transform(credential.apiKey),
    }),
  );

  return {
    "airtable.airtableAPIKey": transform(
      settings.airtable?.airtableAPIKey,
    ),
    "ai.apiKey": transform(settings.ai?.apiKey),
    "ai.providerCredentials": providerCredentials,
    "meedan.meedanAPIKey": transform(settings.meedan?.meedanAPIKey),
  };
};

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const db = payload.db as MongooseAdapter;
  const usersModel = db.collections.users;
  // All globals share a single collection, discriminated by `globalType`.
  const globalsModel = db.globals;

  if (!usersModel || !globalsModel) {
    throw new Error("Failed to resolve users or globals models");
  }

  // `_id` keeps the driver's ObjectId type; only the fields we read are
  // narrowed to the generated User shape.
  const users = (
    await usersModel.collection
      .find({})
      .sort({ createdAt: 1, _id: 1 })
      .toArray()
  ).map((doc) => ({ ...(doc as RawUser), _id: doc._id }));

  const configuredSuperAdmins = new Set(
    (process.env.PAYLOAD_SUPER_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

  let hasSuperAdmin = users.some((user) =>
    user.roles?.includes("superAdmin"),
  );

  for (const [index, user] of users.entries()) {
    if (Array.isArray(user.roles) && user.roles.length > 0) {
      continue;
    }

    const configured =
      typeof user.email === "string" &&
      configuredSuperAdmins.has(user.email.toLowerCase());
    const roles =
      configured || (!hasSuperAdmin && index === 0)
        ? ["superAdmin"]
        : ["globalEditor"];

    if (roles.includes("superAdmin")) {
      hasSuperAdmin = true;
    }

    await usersModel.collection.updateOne(
      { _id: user._id },
      { $set: { roles } },
    );
  }

  const settingsDoc = await globalsModel.collection.findOne({
    globalType: "settings",
  });

  if (settingsDoc) {
    await globalsModel.collection.updateOne(
      { _id: settingsDoc._id },
      {
        $set: transformSettingsSecrets(settingsDoc as RawSettings, (value) =>
          encryptValue(value, (secret) => payload.encrypt(secret)),
        ),
      },
    );
  }

  payload.logger.info({
    msg: "protectPrivilegedSettings:: Assigned user roles and encrypted saved credentials",
    usersProcessed: users.length,
  });
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  const db = payload.db as MongooseAdapter;
  const usersModel = db.collections.users;
  const globalsModel = db.globals;

  if (!usersModel || !globalsModel) {
    throw new Error("Failed to resolve users or globals models");
  }

  const settingsDoc = await globalsModel.collection.findOne({
    globalType: "settings",
  });

  if (settingsDoc) {
    await globalsModel.collection.updateOne(
      { _id: settingsDoc._id },
      {
        $set: transformSettingsSecrets(settingsDoc as RawSettings, (value) =>
          decryptValue(value, (secret) => payload.decrypt(secret)),
        ),
      },
    );
  }

  await usersModel.collection.updateMany({}, { $unset: { roles: "" } });
}
