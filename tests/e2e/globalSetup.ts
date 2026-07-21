import { config as loadEnv } from "dotenv";
import { MongoClient } from "mongodb";

import { assertIsolatedTestDatabase } from "../../src/lib/testDatabaseGuard";

/**
 * E2E global setup. Loads the dedicated test env, enforces the isolated-DB
 * guard, and resets the target database before the suite so runs are
 * repeatable. Playwright starts the app (webServer) against this same
 * DATABASE_URI, which in CI is a MongoDB service container.
 */
export default async function globalSetup() {
  loadEnv({ path: ".env.test" });

  const uri = process.env.DATABASE_URI;
  const dbName = assertIsolatedTestDatabase(uri);

  const client = new MongoClient(uri as string);
  try {
    await client.connect();
    await client.db(dbName).dropDatabase();
  } finally {
    await client.close();
  }
}
