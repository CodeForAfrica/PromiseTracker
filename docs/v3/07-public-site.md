# 7. Public site

## 7.1 Routing

One site, one deployment, country as a path segment (D10). No subdomains, no tenant resolution,
no `getDomain()`, no multi-tenant plugin.

```
/                                   Global home, country selector
/about, /methodology, /{pageSlug}   Global pages

/{cc}                               Country landing
/{cc}/politicians                   Listing, filterable
/{cc}/politicians/{slug}            Profile: scorecard, promises, map
/{cc}/parties                       Listing
/{cc}/parties/{slug}                Profile
/{cc}/institutions                  Listing
/{cc}/institutions/{slug}           Profile
/{cc}/places                        Listing
/{cc}/places/{slug}                 Profile: map, promises in and to this place
/{cc}/promises                      All claims, filterable and paginated
/{cc}/promises/{slug}               Claim page: statement, evidence, timeline, map
/{cc}/search                        Search results
/{cc}/{pageSlug}                    Country page (about, methodology, partners)
```

`cc` is `Country.code`, the lowercase ISO 3166-1 alpha-2 code: `/ke`, `/za`, `/ng`.

### Typed segments (D15)

Each actor kind has its own segment, so a slug need only be unique within `(country, kind)`.

| Kind | Segment |
|---|---|
| `person` | `politicians` |
| `party` | `parties` |
| `institution` | `institutions` |
| `place` | `places` |

`/ke/politicians/nairobi` and `/ke/places/nairobi` can coexist. A flat `/ke/{slug}` would force
global slug uniqueness across every kind and require a lookup across all of them before the
server knows what it is rendering. That is what v2 does, and why its catch-all route runs to 443
lines with four near-identical branches.

Slug validation on `Pages` reserves the first segments under a country: `politicians`,
`parties`, `institutions`, `places`, `promises`, `search`, `api`, `embed`, `sitemap.xml` and
`feed`.

### Resolution

The country is the first segment. Middleware resolves it once per request from a cached map of
code to id, a handful of records cached indefinitely and invalidated on country change, then
passes it down through the request context. Blocks and components receive the resolved country
and actor, and never re-query by slug.

That rule comes from v2's `src/lib/routes/publicRoutes.ts`, where it prevented cross-tenant slug
collisions. Here it is also a performance rule: v2 re-ran `getTenantBySubDomain()`, which itself
calls `getAllTenants()`, from the layout, `generateMetadata`, the page body and five block
components, so one render re-queried the tenant list half a dozen times.

An unknown country code returns 404. No fallback, no redirect to a default.

## 7.2 Caching

The single biggest performance lever. v2 sets `export const dynamic = "force-dynamic"` on every
public route and caches nothing at all: no `unstable_cache`, no `revalidate`, no
`generateStaticParams`, no ISR.

v3 caches by tag and invalidates precisely.

| Tag | Invalidated when |
|---|---|
| `country:{code}` | The country record changes |
| `actor:{id}` | That actor, or a claim naming it, changes |
| `claim:{id}` | The claim or any of its updates changes |
| `claims:{country}` | Any claim in that country is published or unpublished |
| `statuses`, `categories` | The taxonomy changes |
| `settings` | Site settings change |

- Page data is wrapped in `unstable_cache` with the relevant tags and a long `revalidate`
  ceiling as a backstop.
- `generateStaticParams` prerenders country landings, actor profiles and claim pages for
  published records. The long tail renders on demand and is then cached.
- The cascade job calls `revalidateTag` on completion
  ([§4.3](04-governance.md#43-the-cascade)), so publishing propagates in seconds rather than
  waiting for a timer.
- Query `depth` is specified per query. v2 uses `depth: 6` on page loads, which walks
  relationships six levels deep on every render.
- Media is served with `Cache-Control: public, max-age=31536000, immutable`.

The election-day target is a country landing and a claim page served from cache in under 100ms
at the origin, with the CDN absorbing the rest.

## 7.3 Search

v2 renders a search box in `src/components/Search.tsx` with no handler, no route and no index.
v3 ships real search.

- MongoDB text indexes over `claims` (`title`, `statement`, `summary`) and `actors` (`name`,
  `shortName`, `description`), weighted toward titles and names.
- Scoped by country by default, with an all-countries option.
- Results grouped by type: claims, politicians, parties, institutions, places.
- Server-rendered at `/{cc}/search?q=`, so results are linkable and crawlable.
- Isolated behind one module, so moving to Atlas Search or Elasticsearch later touches a single
  file ([§1.6](01-product.md#explicit-non-goals-for-v3)).

## 7.4 Listings and filtering

v2 loads every published promise for an entity with `pagination: false`, derives facets in the
browser, and filters client-side. At 50 promises that is fine. At 5,000 it is a multi-megabyte
payload. v3 instead uses:

- Server-side pagination, 24 per page, cursor or offset.
- Server-side filtering on status group, category, actor, claim type and date range.
- Facet counts from aggregation rather than from the loaded page.
- Filter state in the URL, as in `?status=kept&category=health&page=2`, so a filtered view is
  shareable, bookmarkable and indexable, and the back button works.
- Sorting by most recently updated, deadline or status.

## 7.5 Pages

### Claim page, `/{cc}/promises/{slug}`

The product's most important page.

1. **Header.** Status chip in the colour from the status record, claim type, category, date made,
   and target date if any.
2. **The statement.** The verbatim quote, visually distinct, attributed to the promisor, with a
   link to the source document and page.
3. **Context.** The editorial summary.
4. **Timeline.** Every published `ClaimUpdate` in reverse-chronological order: date, status at
   that date, narrative, evidence links. This is the feature v2 promises and does not have.
5. **Verification.** The verdict, who verified it and when, the rationale, and any published
   fact-check report.
6. **Map.** Where the claim applies, when `jurisdiction` or the promisor's office carries geodata
   ([§7.8](#78-maps-d17)).
7. **Actions.** Share, and submit an update ([§5](05-pipeline.md)).
8. **Related.** Other promises by the same actor in the same category.

### Actor profile, `/{cc}/politicians/{slug}` and siblings

Scorecard first: total promises, and the count and share in each status group, rendered as a
chart. Then office history for a person, current office, party, and a filterable promise list. A
map shows where they are from (`person.originPlace`) and where they govern
(`offices[].jurisdiction`), neither of which v2 could express, having only a free-text `region`.

Status grouping comes from `ClaimStatus.group`
([§3.4](03-data-model.md#34-claim-statuses)), not from per-page block configuration.

### Country landing, `/{cc}`

A country map with regions, headline numbers, featured politicians, recently updated promises,
and entries into each actor listing.

## 7.6 Distribution

### Embeds

v2 sets `frame-ancestors 'self'` in its CSP (`src/lib/security/headers.mjs:53`), so
PromiseTracker pages cannot be embedded anywhere. v3 adds dedicated embed routes with their own
policy, and the main site keeps `'self'`.

```
/embed/claim/{id}            A single promise card with status and last update
/embed/scorecard/{actorId}   An actor's status breakdown
/embed/list?...              A filtered promise list
```

- Served from `/embed/*` only, with `frame-ancestors *` on those routes alone.
- No cookies, no tracking, and no JavaScript beyond an auto-height postMessage.
- A `<script>` snippet handles sizing, and a plain `<iframe>` works without it.
- Each one carries a visible link back to the canonical page.
- An oEmbed endpoint at `/api/oembed`, so pasting a promise URL into a CMS produces the card.

### Public read API

```
GET /api/public/v1/countries
GET /api/public/v1/{cc}/actors?kind=person&page=1
GET /api/public/v1/{cc}/claims?status=kept&category=health&updatedSince=2026-01-01
GET /api/public/v1/{cc}/claims/{slug}
GET /api/public/v1/{cc}/claims/{slug}/updates
```

- Published records only, under the same `_status` filter as the site, so public has one
  definition.
- Stable, documented JSON, not the raw Payload REST surface. v2 exposes `/api/[...slug]` with
  `read: publishedOrAuthenticated` on promises, which makes the internal shape the public
  contract and impossible to change without breaking consumers.
- Unauthenticated, rate-limited per IP, cached at the CDN.
- `Cache-Control` and `ETag` on every response.
- An OpenAPI description at `/api/public/v1/openapi.json`.
- Toggleable through `Settings.features.publicApiEnabled`.

### Export

CSV export of claims and updates, filtered, generated on demand from a live query.

v2 maintains `ai-extraction-export-rows` for this: a 28-column denormalised table kept in sync
by hooks on five collections plus a reconciliation job. v3 queries and streams.

## 7.7 SEO and discoverability

v2 has none of this: no sitemap, no `robots.txt`, no canonicals, no JSON-LD, no `metadataBase`,
no OG images.

| Feature | Implementation |
|---|---|
| Sitemaps | A sitemap index at `/sitemap.xml`, one child per country, split at 50,000 URLs |
| `robots.txt` | Generated, pointing at the sitemap index |
| Canonical URLs | On every page, absolute, from a configured `metadataBase` |
| OG images | Generated per claim and per actor through `next/og`, cached |
| ClaimReview JSON-LD | On every verified claim page |
| Organization, Person and Place JSON-LD | On actor profiles |
| Breadcrumbs | `BreadcrumbList` JSON-LD matching the typed URL structure |
| RSS and Atom | Per country, for recently published and recently updated claims |

ClaimReview is schema.org's standard for fact-checks and what Google's fact-check surfaces
consume. Emitting it makes every verified promise eligible for those surfaces and makes the data
legible to AI assistants that read structured data. It is also the interoperability format the
wider fact-checking community already uses, which matters more now that Superdesk is the review
backend and Superdesk emits NINJS rather than ClaimReview.

```json
{
  "@context": "https://schema.org",
  "@type": "ClaimReview",
  "url": "https://promisetracker.org/ke/promises/200-health-centres",
  "claimReviewed": "We will build 200 new health centres by 2027",
  "itemReviewed": {
    "@type": "Claim",
    "author": { "@type": "Person", "name": "William Ruto" },
    "datePublished": "2022-06-30"
  },
  "author": { "@type": "Organization", "name": "PromiseTracker" },
  "reviewRating": {
    "@type": "Rating",
    "ratingValue": 2, "bestRating": 5, "worstRating": 1,
    "alternateName": "In progress"
  }
}
```

The numeric rating derives from `ClaimStatus.group`, and `alternateName` is the localized label.

## 7.8 Maps (D17)

Where the promise applies, and where the politician is from.

- Rendered from `GeoRef` on the country, the place, or the promisor's office jurisdiction
  ([§3.9](03-data-model.md#39-geo-d17)).
- Boundary polygons are stored GeoJSON uploads, not live third-party geometry. A map that stops
  working because an external tile or boundary service changed its terms is exactly the coupling
  v3 exists to remove. Attribution and licence are required fields.
- Degradation is clean: boundary, then a marker at `centroid`, then no map. A country with no
  geodata shows no map and nothing else breaks.
- Client-side, lazily loaded, below the fold, excluded from LCP. The page is fully readable
  without it.
- Base tiles come from a configured provider with attribution. **CONFIRM** the choice and its
  licence for commercial and embedded use before implementation.

Maps appear on the country landing, optionally shading regions by promise performance, on a
place profile with its own boundary and children, on a politician profile for origin and
jurisdiction, and on a claim page for the jurisdiction it applies to.

## 7.9 Internationalisation

- Content locales `en` and `fr`, per country ([§3.1](03-data-model.md#31-countries)).
- A visible language switcher, which v2 has nowhere despite shipping a bilingual admin and
  localized content.
- Locale as a query parameter or a cookie-backed preference, with `hreflang` alternates on every
  page.
- All UI strings localized. v2 hardcodes English filter and sort labels in
  `src/components/Promises/index.tsx` and leaves `promise-list.title` unlocalized.

## 7.10 Accessibility and performance budgets

| Target | Budget |
|---|---|
| LCP | < 2.5s on 4G |
| CLS | < 0.1 |
| TTI | < 3s |
| JS on a claim page | < 150 KB gzipped, excluding the lazily-loaded map |
| Contrast | WCAG AA, including every status chip colour |
| Keyboard | Every filter, timeline control and map control reachable |
| Screen readers | The timeline is a semantic ordered list, not a decorative SVG |

Status colours are editor-configurable, so the admin shows a live contrast check against the
chosen text colour and warns below AA. v2 lets an editor pick any pair of colours with no check
at all.
