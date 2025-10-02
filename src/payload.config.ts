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
import { en } from "@payloadcms/translations/languages/en";
import { fr } from "@payloadcms/translations/languages/fr";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

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
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || "",
  }),
  editor: lexicalEditor(),
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
    tasks,
    workflows,
    autoRun: [
      {
        cron: process.env.PAYLOAD_JOBS_CRON_SCHEDULE || "* * * * *",
        queue: process.env.PAYLOAD_JOBS_QUEUE || "everyMinute",
      },
    ],
  },
  localization: {
    locales,
    defaultLocale,
  },
  plugins,
  sharp,
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  onInit: async (payload) => {
    await payload.jobs.queue({
      workflow: "airtableWorkflow",
      input: {},
    });
  },
});
