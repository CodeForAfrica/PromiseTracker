// Runs in each Vitest worker before test modules are imported.
import { config } from "dotenv";
import { inject } from "vitest";

import { assertIsolatedTestDatabase } from "./src/lib/testDatabaseGuard";

// Load the DEDICATED test environment, never .env / .env.local, so tests can
// not inherit developer or production configuration.
config({ path: ".env.test" });

// Point Payload at the unique, isolated test database created in
// vitest.globalSetup.ts. This must happen before any test imports
// @/payload.config, since buildConfig reads DATABASE_URI at import time.
const databaseUri = inject("databaseUri");
process.env.DATABASE_URI = databaseUri;

// Hard guard: refuse to run if anything rewired us onto a shared/prod host.
assertIsolatedTestDatabase(process.env.DATABASE_URI);
