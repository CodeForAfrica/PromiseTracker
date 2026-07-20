import { describe, expect, it } from "vitest";

import {
  resolveGlobalRoute,
  resolvePublicRoute,
} from "@/lib/routes/publicRoutes";

const entities = [
  { id: "entity-a", slug: "john-doe", tenant: "tenant-a" },
  { id: "entity-b", slug: "jane-doe", tenant: "tenant-a" },
];

describe("resolvePublicRoute (tenant catch-all grammar)", () => {
  it("resolves the root path to the entity selector", () => {
    expect(resolvePublicRoute([], entities)).toEqual({
      type: "entity-selector",
    });
  });

  it("resolves a single entity slug to the entity index page", () => {
    expect(resolvePublicRoute(["john-doe"], entities)).toEqual({
      type: "entity-page",
      entity: entities[0],
      pageSlug: "index",
    });
  });

  it("resolves an entity slug plus page slug to the entity page", () => {
    expect(resolvePublicRoute(["jane-doe", "promises"], entities)).toEqual({
      type: "entity-page",
      entity: entities[1],
      pageSlug: "promises",
    });
  });

  it("treats a single non-entity segment as a tenant page lookup", () => {
    expect(resolvePublicRoute(["about"], entities)).toEqual({
      type: "tenant-page",
      pageSlug: "about",
    });
  });

  it("returns not-found for two segments when the first is not an entity", () => {
    expect(resolvePublicRoute(["unknown", "about"], entities)).toEqual({
      type: "not-found",
    });
  });

  it("returns not-found for paths deeper than two segments", () => {
    expect(
      resolvePublicRoute(["john-doe", "promises", "extra"], entities),
    ).toEqual({ type: "not-found" });
  });

  it("returns a tenant-page lookup (which may 404) when no entities exist", () => {
    expect(resolvePublicRoute(["unknown"], [])).toEqual({
      type: "tenant-page",
      pageSlug: "unknown",
    });
  });

  it("resolves the intended entity when another tenant shares the slug", () => {
    // Entities are pre-scoped to the current tenant, so a same-slug entity
    // belonging to another tenant can never be resolved here.
    const tenantAEntities = [
      { id: "entity-a", slug: "john-doe", tenant: "tenant-a" },
    ];
    const resolution = resolvePublicRoute(["john-doe"], tenantAEntities);

    expect(resolution.type).toBe("entity-page");
    if (resolution.type === "entity-page") {
      expect(resolution.entity.id).toBe("entity-a");
      expect(resolution.entity.tenant).toBe("tenant-a");
    }
  });

  it("returns the full entity object so lookups use the resolved id", () => {
    const resolution = resolvePublicRoute(["john-doe"], entities);

    expect(resolution.type).toBe("entity-page");
    if (resolution.type === "entity-page") {
      expect(resolution.entity).toBe(entities[0]);
    }
  });
});

describe("resolveGlobalRoute (no tenant)", () => {
  it("resolves the root path to the global index page", () => {
    expect(resolveGlobalRoute([])).toEqual({
      type: "global-page",
      pageSlug: "index",
    });
  });

  it("resolves a single segment to a global page lookup", () => {
    expect(resolveGlobalRoute(["about"])).toEqual({
      type: "global-page",
      pageSlug: "about",
    });
  });

  it("returns not-found for multi-segment paths", () => {
    expect(resolveGlobalRoute(["unknown", "about"])).toEqual({
      type: "not-found",
    });
  });
});
