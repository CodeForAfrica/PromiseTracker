/**
 * Route grammar for the public catch-all route (`src/app/(frontend)/[...slugs]`).
 *
 * On a tenant subdomain:
 *   /                       -> entity selector (tenant landing page)
 *   /:slug                  -> entity index page when `:slug` matches a
 *                              published political-entity slug for the tenant,
 *                              otherwise a tenant (or global) page with that slug
 *   /:entitySlug/:pageSlug  -> entity page; the first segment MUST match a
 *                              published political-entity slug for the tenant
 *   anything else           -> 404
 *
 * Without a tenant (apex domain):
 *   /                       -> global "index" page
 *   /:pageSlug              -> global page with that slug
 *   anything else           -> 404
 *
 * Any path that does not match this grammar must call `notFound()` — there is
 * no fallback content for unknown paths.
 */

type EntityLike = { slug: string };

export type PublicRouteResolution<Entity extends EntityLike> =
  | { type: "entity-selector" }
  | { type: "entity-page"; entity: Entity; pageSlug: string }
  | { type: "tenant-page"; pageSlug: string }
  | { type: "not-found" };

/**
 * Resolves the tenant catch-all path segments against the tenant's published
 * political entities. `entities` must already be scoped to the current tenant
 * so that a slug collision with another tenant's entity can never resolve
 * here; callers must use the returned entity object (not re-query by slug).
 */
export const resolvePublicRoute = <Entity extends EntityLike>(
  slugs: string[],
  entities: Entity[],
): PublicRouteResolution<Entity> => {
  if (slugs.length === 0) {
    return { type: "entity-selector" };
  }

  if (slugs.length > 2) {
    return { type: "not-found" };
  }

  const [first, second] = slugs;
  const entity = entities.find((candidate) => candidate.slug === first);

  if (entity) {
    return { type: "entity-page", entity, pageSlug: second ?? "index" };
  }

  // Two segments require the first to be an entity slug; `/unknown/about`
  // and similar paths are invalid rather than page lookups.
  if (slugs.length === 2) {
    return { type: "not-found" };
  }

  return { type: "tenant-page", pageSlug: first };
};

/**
 * Resolves catch-all path segments when no tenant matched the subdomain.
 * Only `/` and `/:pageSlug` are valid global paths.
 */
export const resolveGlobalRoute = (
  slugs: string[],
): { type: "global-page"; pageSlug: string } | { type: "not-found" } => {
  if (slugs.length > 1) {
    return { type: "not-found" };
  }

  return { type: "global-page", pageSlug: slugs[0] ?? "index" };
};
