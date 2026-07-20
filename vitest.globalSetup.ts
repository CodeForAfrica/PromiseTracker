import { config as loadEnv } from "dotenv";
import { MongoClient } from "mongodb";
import type { TestProject } from "vitest/node";

import {
  assertIsolatedTestDatabase,
  withDatabaseName,
} from "./src/lib/testDatabaseGuard";

/**
 * Global setup for integration tests. Derives a UNIQUE, test-named database
 * from the local/CI MongoDB (never a shared/hosted cluster — enforced by the
 * guard) so every run is isolated, and drops it before and after the suite so
 * the database is reset around the run. The connection string is handed to the
 * workers via `provide`.
 *
 * Requires a local MongoDB (developers: run one locally; CI provides a service
 * container). A missing server does not break the many fully-mocked unit tests
 * — only the DB-backed API test will surface the connection error.
 */
loadEnv({ path: ".env.test" });

const uniqueDbName = () =>
  `promisetracker_int_test_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

let databaseUri: string;

export default async function setup({ provide }: TestProject) {
  const baseUri = process.env.DATABASE_URI;
  if (!baseUri) {
    throw new Error(
      "DATABASE_URI must be set (see .env.test) to run integration tests",
    );
  }

  databaseUri = withDatabaseName(baseUri, uniqueDbName());
  assertIsolatedTestDatabase(databaseUri);

  await resetDatabase(databaseUri, "before suite");

  provide("databaseUri", databaseUri);
}

export async function teardown() {
  if (databaseUri) {
    await resetDatabase(databaseUri, "after suite");
  }
}

const resetDatabase = async (uri: string, phase: string) => {
  const dbName = assertIsolatedTestDatabase(uri);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5_000 });
  try {
    await client.connect();
    await client.db(dbName).dropDatabase();
  } catch (error) {
    // Best-effort: keep fully-mocked unit tests runnable without a local DB.
    // eslint-disable-next-line no-console
    console.warn(
      `vitest.globalSetup:: could not reset test database ${phase}:`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    await client.close();
  }
};

declare module "vitest" {
  interface ProvidedContext {
    databaseUri: string;
  }
}
