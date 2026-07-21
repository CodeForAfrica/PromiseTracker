import { describe, expect, it } from "vitest";

import {
  assertIsolatedTestDatabase,
  UnsafeTestDatabaseError,
  withDatabaseName,
} from "@/lib/testDatabaseGuard";

describe("assertIsolatedTestDatabase", () => {
  it("accepts a local, test-named database", () => {
    expect(
      assertIsolatedTestDatabase(
        "mongodb://127.0.0.1:27017/promisetracker_int_test",
      ),
    ).toBe("promisetracker_int_test");
    expect(
      assertIsolatedTestDatabase("mongodb://localhost:27017/pt_ci_test"),
    ).toBe("pt_ci_test");
  });

  it("accepts the docker/CI service-container hostname", () => {
    expect(
      assertIsolatedTestDatabase("mongodb://mongodb:27017/pt_test"),
    ).toBe("pt_test");
  });

  it("rejects mongodb+srv hosted-cluster URIs", () => {
    expect(() =>
      assertIsolatedTestDatabase(
        "mongodb+srv://user:pass@cluster0.abcde.mongodb.net/promisetracker",
      ),
    ).toThrowError(UnsafeTestDatabaseError);
  });

  it("rejects Atlas hosts even without the +srv scheme", () => {
    expect(() =>
      assertIsolatedTestDatabase(
        "mongodb://user:pass@cluster0-shard-00-00.abcde.mongodb.net:27017/db",
      ),
    ).toThrowError(/shared\/hosted host/);
  });

  it("rejects other non-local hosts", () => {
    expect(() =>
      assertIsolatedTestDatabase("mongodb://10.1.2.3:27017/whatever_test"),
    ).toThrowError(/non-local host/);
  });

  it("rejects production/shared-looking database names on a local host", () => {
    expect(() =>
      assertIsolatedTestDatabase("mongodb://127.0.0.1:27017/promisetracker_prod"),
    ).toThrowError(/production\/shared/);
    expect(() =>
      assertIsolatedTestDatabase("mongodb://localhost:27017/staging"),
    ).toThrowError(UnsafeTestDatabaseError);
  });

  it("rejects empty, hostless, or nameless connection strings", () => {
    expect(() => assertIsolatedTestDatabase("")).toThrowError(
      UnsafeTestDatabaseError,
    );
    expect(() => assertIsolatedTestDatabase(undefined)).toThrowError(
      UnsafeTestDatabaseError,
    );
    expect(() =>
      assertIsolatedTestDatabase("mongodb://127.0.0.1:27017/"),
    ).toThrowError(/no database name/);
  });
});

describe("withDatabaseName", () => {
  it("replaces the database name preserving host and query", () => {
    expect(
      withDatabaseName("mongodb://127.0.0.1:27017/old", "new_test"),
    ).toBe("mongodb://127.0.0.1:27017/new_test");
    expect(
      withDatabaseName(
        "mongodb://127.0.0.1:27017/old?retryWrites=true",
        "new_test",
      ),
    ).toBe("mongodb://127.0.0.1:27017/new_test?retryWrites=true");
  });

  it("adds a database name when the base URI has none", () => {
    expect(withDatabaseName("mongodb://127.0.0.1:27017", "fresh_test")).toBe(
      "mongodb://127.0.0.1:27017/fresh_test",
    );
  });

  it("produces a URI the guard accepts", () => {
    const uri = withDatabaseName(
      "mongodb://127.0.0.1:27017/base",
      "promisetracker_int_test_abc",
    );
    expect(assertIsolatedTestDatabase(uri)).toBe(
      "promisetracker_int_test_abc",
    );
  });
});
