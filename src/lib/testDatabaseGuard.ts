/**
 * Hard guard that keeps the verification pipeline from ever connecting to a
 * shared or production-like MongoDB. It is intentionally strict: anything it
 * cannot positively identify as a local or ephemeral test database is
 * rejected. Used by the Vitest and Playwright harnesses (and optionally at
 * app startup via PT_ASSERT_TEST_DB) so an isolated DB is enforced, not
 * merely conventional.
 */

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "mongodb", // docker-compose / CI service container hostname
]);

// Substrings that indicate a shared/hosted cluster which must never be used
// by tests, regardless of the database name.
const FORBIDDEN_HOST_SUBSTRINGS = [
  "mongodb.net", // MongoDB Atlas
  "mongodb.com",
  "documentdb", // AWS DocumentDB
  "cosmos.azure.com",
  "amazonaws.com",
  "digitalocean.com",
  "ondigitalocean.app",
];

// Database names that look production/shared even on a local host.
const FORBIDDEN_DB_NAME_SUBSTRINGS = ["prod", "production", "staging", "live"];

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(
      `Refusing to run tests against a non-isolated database: ${message}. ` +
        `Tests require a local or ephemeral database (see .env.test / the test harness).`,
    );
    this.name = "UnsafeTestDatabaseError";
  }
}

type ParsedUri = {
  isSrv: boolean;
  hosts: string[];
  dbName: string;
};

const parseMongoUri = (uri: string): ParsedUri => {
  const match = /^mongodb(\+srv)?:\/\/([^/?]+)(?:\/([^?]*))?/i.exec(uri);
  if (!match) {
    throw new UnsafeTestDatabaseError(`unrecognized connection string`);
  }

  const isSrv = Boolean(match[1]);
  const authority = match[2] ?? "";
  // Strip credentials before extracting hosts.
  const hostSection = authority.includes("@")
    ? authority.slice(authority.lastIndexOf("@") + 1)
    : authority;

  const hosts = hostSection
    .split(",")
    .map((hostPort) => hostPort.replace(/:\d+$/, "").trim().toLowerCase())
    .filter(Boolean);

  const dbName = decodeURIComponent(match[3] ?? "").trim();

  return { isSrv, hosts, dbName };
};

const isLocalHost = (host: string): boolean =>
  LOCAL_HOSTS.has(host) ||
  host.endsWith(".localhost") ||
  host.startsWith("127.");

/**
 * Throws UnsafeTestDatabaseError unless `uri` is a safe, isolated test
 * database. Returns the parsed database name on success.
 */
export const assertIsolatedTestDatabase = (
  uri: string | undefined | null,
): string => {
  if (!uri || !uri.trim()) {
    throw new UnsafeTestDatabaseError("DATABASE_URI is empty");
  }

  const { isSrv, hosts, dbName } = parseMongoUri(uri);

  // SRV records almost always resolve to hosted clusters (Atlas); never allow.
  if (isSrv) {
    throw new UnsafeTestDatabaseError("mongodb+srv:// (hosted cluster) URIs");
  }

  if (hosts.length === 0) {
    throw new UnsafeTestDatabaseError("no host in connection string");
  }

  for (const host of hosts) {
    if (FORBIDDEN_HOST_SUBSTRINGS.some((forbidden) => host.includes(forbidden))) {
      throw new UnsafeTestDatabaseError(`shared/hosted host "${host}"`);
    }
    if (!isLocalHost(host)) {
      throw new UnsafeTestDatabaseError(`non-local host "${host}"`);
    }
  }

  if (!dbName) {
    throw new UnsafeTestDatabaseError("no database name in connection string");
  }

  const normalizedDbName = dbName.toLowerCase();
  for (const forbidden of FORBIDDEN_DB_NAME_SUBSTRINGS) {
    if (normalizedDbName.includes(forbidden)) {
      throw new UnsafeTestDatabaseError(
        `database name "${dbName}" looks production/shared`,
      );
    }
  }

  return dbName;
};

/**
 * Returns a copy of `uri` with its database name replaced. Used to derive a
 * unique per-run database from a base connection string so concurrent local
 * and CI runs never share state.
 */
export const withDatabaseName = (uri: string, dbName: string): string => {
  const match = /^(mongodb(?:\+srv)?:\/\/[^/?]+)(?:\/[^?]*)?(\?.*)?$/i.exec(uri);
  if (!match) {
    throw new UnsafeTestDatabaseError("unrecognized connection string");
  }
  const base = match[1];
  const query = match[2] ?? "";
  return `${base}/${dbName}${query}`;
};

export const __testDatabaseGuardInternals = {
  parseMongoUri,
  isLocalHost,
};
