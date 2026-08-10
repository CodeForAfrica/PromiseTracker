import { Plugin } from "payload";
import { sentryPlugin } from "@payloadcms/plugin-sentry";
import * as Sentry from "@sentry/nextjs";
import { multiTenantPlugin } from "@payloadcms/plugin-multi-tenant";
import { importExportPlugin } from "@payloadcms/plugin-import-export";
import { Config } from "@/payload-types";
import { capitalizeFirstLetter, isProd } from "@/utils/utils";
import { createExportHeaderHook } from "@/lib/exportColumnLabels";
import { s3Storage } from "@payloadcms/storage-s3";
import { seoPlugin } from "@payloadcms/plugin-seo";
import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext";

const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? "";
const bucket = process.env.S3_BUCKET ?? "";
const region = process.env.S3_REGION ?? "";
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? "";
const s3Enabled = !!accessKeyId && !!region && !!secretAccessKey;

export const plugins: Plugin[] = [
  importExportPlugin({
    debug: !isProd,
    collections: [
      {
        slug: "promises",
        export: {
          hooks: {
            before: createExportHeaderHook("promises"),
          },
        },
      },
      {
        slug: "ai-extraction-export-rows",
        export: {
          format: "csv",
          hooks: {
            before: createExportHeaderHook("ai-extraction-export-rows"),
          },
        },
        import: false,
      },
    ],
    overrideExportCollection: ({ collection }) => ({
      ...collection,
      access: {
        ...collection.access,
        create: ({ req }) => Boolean(req.user),
        read: ({ req }) => Boolean(req.user),
      },
      admin: {
        ...collection.admin,
        components: {
          ...collection.admin?.components,
          edit: {
            ...collection.admin?.components?.edit,
            // The plugin's default Download button is disabled once the doc
            // is saved and, even when enabled, regenerates a fresh export
            // instead of serving the saved file. This fork keeps it enabled
            // and downloads the already-saved file when there is one.
            SaveButton: "@/components/payload/ExportSaveButton#ExportSaveButtonFixed",
            // The exports collection denies update access to everyone (it's
            // immutable once generated), so Payload never mounts the
            // edit.SaveButton slot above once a doc is saved — the "Fixed"
            // button vanishes entirely on revisit, not just disabled.
            // beforeDocumentControls renders unconditionally, so it's the
            // only reliable place for an always-available redownload button.
            beforeDocumentControls: [
              "@/components/payload/ExportDownloadButton#ExportDownloadButton",
            ],
          },
        },
        group: {
          en: "Documents",
          fr: "Documents",
        },
      },
    }),
  }),
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
        read: ({ req }) => Boolean(req.user),
      },
    },
    debug: !isProd,
    userHasAccessToAllTenants: () => true,
  }),
  sentryPlugin({ Sentry }),
  s3Storage({
    collections: {
      media: true,
      // Saved exports (Documents > Exports) must survive container
      // restarts/redeploys, so they're durable enough to re-download later.
      exports: true,
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
    collections: ["pages", "political-entities", "promises", "global-pages"],
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

      if (collectionSlug === "pages" || collectionSlug === "global-pages") {
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
