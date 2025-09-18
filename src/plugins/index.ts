import { Plugin } from "payload";
import { sentryPlugin } from "@payloadcms/plugin-sentry";
import * as Sentry from "@sentry/nextjs";
import { multiTenantPlugin } from "@payloadcms/plugin-multi-tenant";
import { Config } from "@/payload-types";
import { isProd } from "@/utils/utils";
import { s3Storage } from "@payloadcms/storage-s3";

const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? "";
const bucket = process.env.S3_BUCKET ?? "";
const region = process.env.S3_REGION ?? "";
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? "";
const s3Enabled = !!accessKeyId && !!region && !!secretAccessKey;

export const plugins: Plugin[] = [
  multiTenantPlugin<Config>({
    collections: {
      pages: {},
      "site-settings": {
        isGlobal: true,
      },
      "political-entities": {},
    },
    cleanupAfterTenantDelete: false,
    tenantField: {
      access: {
        read: () => true,
      },
    },
    debug: !isProd,
    userHasAccessToAllTenants: () => true,
  }),
  sentryPlugin({ Sentry }),
  s3Storage({
    collections: {
      media: true,
    },
    bucket,
    config: {
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      region,
    },
    enabled: s3Enabled,
  }),
];
