import { describe, expect, it } from "vitest";

import { buildPublishedPromisesQuery } from "@/lib/data/promiseQueries";

describe("published promises list query", () => {
  it("deliberately disables pagination for the main promise list", () => {
    const query = buildPublishedPromisesQuery("entity-a");

    // Without this, Payload silently caps results at its default page size
    // (10) and the list omits records with no indication.
    expect(query).toMatchObject({ pagination: false });
    expect(query).not.toHaveProperty("limit");
  });

  it("scopes results to the resolved entity id and published status", () => {
    const query = buildPublishedPromisesQuery("entity-a");

    expect(query.where).toEqual({
      and: [
        { politicalEntity: { equals: "entity-a" } },
        { publishStatus: { equals: "published" } },
      ],
    });
  });

  it("supports an explicit bounded limit for teaser lists", () => {
    const query = buildPublishedPromisesQuery("entity-a", { limit: 3 });

    expect(query).toMatchObject({ limit: 3 });
    expect(query).not.toHaveProperty("pagination");
  });

  it("passes the locale through when provided", () => {
    expect(buildPublishedPromisesQuery("entity-a", { locale: "fr" })).toMatchObject(
      { locale: "fr" },
    );
  });
});
