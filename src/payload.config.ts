// storage-adapter-import-placeholder
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { nodemailerAdapter } from "@payloadcms/email-nodemailer";
import type { NodemailerAdapterArgs } from "@payloadcms/email-nodemailer";
import path from "node:path";
import { buildConfig } from "payload";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { Users } from "@/collections/Users";
import { collections } from "@/collections";
import { globals } from "@/globals";
import { tasks } from "@/tasks";
import { workflows } from "@/workflows";
import { isProd } from "@/utils/utils";
import { plugins } from "@/plugins";
import * as Sentry from "@sentry/nextjs";
import { defaultLocale, locales } from "@/utils/locales";
import {
  AI_EXTRACTION_EXPORT_ROWS_SYNC_CRON_SCHEDULE,
  AI_EXTRACTION_EXPORT_ROWS_SYNC_LIMIT,
  AI_EXTRACTION_EXPORT_ROWS_SYNC_QUEUE,
} from "@/lib/aiExtractionExportRowsJobs";
import { en } from "@payloadcms/translations/languages/en";
import { fr } from "@payloadcms/translations/languages/fr";
import { assertIsolatedTestDatabase } from "@/lib/testDatabaseGuard";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const ONE_GIB_IN_BYTES = 1024 * 1024 * 1024;

const payloadSecret = process.env.PAYLOAD_SECRET;
if (!payloadSecret) {
  throw new Error("PAYLOAD_SECRET is required");
}

const databaseUri = process.env.DATABASE_URI;
if (!databaseUri) {
  throw new Error("DATABASE_URI is required");
}

// When running the verification pipeline (tests / E2E dev server), refuse to
// boot against a shared or production-like database.
if (process.env.PT_ASSERT_TEST_DB === "true") {
  assertIsolatedTestDatabase(databaseUri);
}

let nodemailerAdapterArgs: NodemailerAdapterArgs | undefined;
if (process.env.SMTP_HOST && process.env.SMTP_PASS) {
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  nodemailerAdapterArgs = {
    defaultFromAddress:
      process.env.SMTP_FROM_ADDRESS || "noreply@codeforafrica.africa",
    defaultFromName: process.env.SENDGRID_FROM_NAME || "PromiseTracker CMS",
    // Any Nodemailer transport can be used
    transportOptions: {
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465, // true for port 465, false (the default) for others
      auth: {
        user: process.env.SMTP_USER || "apikey",
        pass: process.env.SMTP_PASS,
      },
    },
  };
}
const email = nodemailerAdapter(nodemailerAdapterArgs);

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections,
  upload: {
    limits: {
      fileSize: ONE_GIB_IN_BYTES,
    },
    debug: !isProd,
    uploadTimeout: 300 * 1000,
  },
  db: mongooseAdapter({
    url: databaseUri,
  }),
  editor: lexicalEditor(),
  graphQL: {
    disable: true,
  },
  email,
  globals,
  hooks: {
    afterError: [
      async ({ error }) => {
        Sentry.captureException(error);
      },
    ],
  },
  i18n: {
    supportedLanguages: { en, fr },
  },
  jobs: {
    // For debugging in Admin
    jobsCollectionOverrides: ({ defaultJobsCollection }) => {
      if (!defaultJobsCollection.admin) {
        defaultJobsCollection.admin = {};
      }

      defaultJobsCollection.admin.hidden = isProd;
      return defaultJobsCollection;
    },
    addParentToTaskLog: true,
    deleteJobOnComplete: true,
    autoRun: [
      {
        cron: process.env.PAYLOAD_JOBS_CRON_SCHEDULE || "* * * * *",
        queue: process.env.PAYLOAD_JOBS_QUEUE || "everyMinute",
      },
      {
        // The import-export plugin queues createCollectionExport jobs on the
        // default queue; without a runner here, admin exports never execute.
        cron: process.env.PAYLOAD_DEFAULT_QUEUE_CRON_SCHEDULE || "* * * * *",
        queue: "default",
      },
      {
        cron: AI_EXTRACTION_EXPORT_ROWS_SYNC_CRON_SCHEDULE,
        limit: AI_EXTRACTION_EXPORT_ROWS_SYNC_LIMIT,
        queue: AI_EXTRACTION_EXPORT_ROWS_SYNC_QUEUE,
      },
      {
        cron: "0 * * * *",
        queue: process.env.PAYLOAD_JOBS_CLEANUP_QUEUE || "cleanup",
      },
    ],
    tasks,
    workflows,
  },
  localization: {
    locales,
    defaultLocale,
  },
  plugins,
  sharp,
  secret: payloadSecret,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
});
