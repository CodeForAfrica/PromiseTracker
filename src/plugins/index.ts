import { Plugin } from "payload";
import { sentryPlugin } from "@payloadcms/plugin-sentry";
import * as Sentry from "@sentry/nextjs";
import { multiTenantPlugin } from "@payloadcms/plugin-multi-tenant";
import { Config } from "@/payload-types";
import { capitalizeFirstLetter, isProd } from "@/utils/utils";
import { s3Storage } from "@payloadcms/storage-s3";
import { seoPlugin } from "@payloadcms/plugin-seo";
import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext";

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
  seoPlugin({
    collections: ["pages", "political-entities", "promises"],
    uploadsCollection: "media",
    generateTitle: async ({ doc, collectionSlug, req }) => {
      const tenantId = doc.tenant;

      const {
        docs: [tenant],
      } = await req.payload.find({
        collection: "tenants",
        where: {
          id: {
            equals: tenantId,
          },
        },
      });

      if (collectionSlug === "political-entities") {
        return `${doc.name} - ${doc.position} | ${tenant?.name}`;
      }

      if (collectionSlug === "pages") {
        return `${capitalizeFirstLetter(doc.title)} | ${tenant?.name}`;
      }

      return doc.title || doc.name;
    },
    generateDescription: ({ doc }) => {
      const data = doc?.description || doc?.excerpt;
      if (data) {
        return convertLexicalToPlaintext({ data }) || data;
      }
      return "";
    },
    generateImage: async ({ doc }) => doc?.image || doc?.primaryLogo || "",
  }),
];
