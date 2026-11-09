# 10. Roadmap

## 10.1 Phasing

Each phase ends with something usable. Nothing here is a big-bang release.

### Phase 1. The core, standing alone

Goal: a complete, publishable PromiseTracker with no external dependency (D4).

Kernel, plugin contract, registry and boot validation. Every collection in
[§3](03-data-model.md). `recordStatus`, `_status` and the cascade. Roles. Admin upload and URL
connectors. Plaintext and HTML extraction. CSV and XLSX import. The native review queue. The
public site with typed routes, caching, pagination, filtering and search. Sitemaps, canonicals,
OG images and ClaimReview. The submission form and moderation queue.

Done when a non-developer stands up a country, enters a politician and a promise by hand, adds
three dated updates, publishes, and the public page renders the timeline, with no API key
anywhere in the environment.

### Phase 2. Scale and assist

`plugin-tika` for PDF, Word, Excel and the rest. `plugin-ai` with one provider. The candidate
review UI. Maps (D17). Embeds and the public read API. CSV export. The language switcher.
Per-country editorial scoping ([§4.6](04-governance.md#46-what-v3-does-not-do-d16)).

Country scoping is first in this phase, not last. It is a `where` clause and a field guard with
no migration, and it has to exist before a partner newsroom gets an account.

### Phase 3. The newsroom

`plugin-superdesk`. Superdesk instance configuration and validation. The HTTP-push receiver and
the reconciliation poll. Verdict round-trip. The cutover from `native` to `superdesk`
verification.

Superdesk is deliberately last, and deliberately after launch
([§9.6](09-launch.md#96-launch-sequence)). Integrating with a newsroom system that must be
configured before the integration can work is the step most likely to slip on someone else's
calendar, and nothing before it should wait on that.

### Later

Additional LLM adapters. OCR for scanned manifestos. RSS and feed connectors. Automated
candidate detection from news. Additional languages. Comparison views across countries. Alerting
for citizens following a promise.

## 10.2 Scale targets

| | Phase 1 | Phase 2 | Phase 3+ |
|---|---|---|---|
| Countries | 5 | 20 | 50+ |
| Actors | 200 | 2,000 | 10,000 |
| Claims | 2,000 | 25,000 | 150,000 |
| Claim updates | 5,000 | 75,000 | 500,000 |
| Documents | 500 | 10,000 | 50,000 |
| Monthly visitors | 20,000 | 200,000 | 1,000,000 |

### How each "must not break" is actually satisfied

Stated as a mechanism rather than an aspiration, which is the check
[§10.4](#104-how-to-review-this-specification) asks for.

| Target | Mechanism |
|---|---|
| More countries and newsrooms | A country is one record with a code. Creating it yields a landing page, listings and a sitemap with no deploy and no configuration ([§7.1](07-public-site.md#71-routing)). There is no tenancy to provision (D10) |
| Public traffic spikes | Tag-based caching with precise `revalidateTag` on publish, `generateStaticParams` for published records, CDN-cacheable embeds and API, immutable media headers. The read path has no external dependency ([§7.2](07-public-site.md#72-caching), [§8.8](08-security-ops.md#88-observability)) |
| Volume of claims and documents | Server-side pagination and filtering with aggregation facets, compound indexes on every listing query, text indexes for search, `depth` specified per query, and a cascade job that batches rather than writing per record ([§7.4](07-public-site.md#74-listings-and-filtering), [§4.3](04-governance.md#scale-note)) |
| Editorial throughput | One indexed `processing.status` as the work queue, a candidate review queue with per-row decisions and attribution, Payload document locking, roles separating contribution from publication, and a moderation queue that never blocks the editorial path ([§5.4](05-pipeline.md#54-processing-state-machine), [§4.5](04-governance.md#45-roles)) |

## 10.3 Open questions

Nothing here blocks writing code in Phase 1. Items marked blocking must be resolved before the
phase they belong to starts.

### Superdesk, all blocking for Phase 3

Every one of these needs a person with access to the instance, not a decision from this
document.

1. **Content API prefix, and whether it is enabled.** Derived from `CONTENTAPI_URL`, it may be
   `/v1`, `/capi` or anything else. Do not hardcode.
2. **Is the Production API deployed?** It is a separate process and many installations skip it.
   If it is absent, reading unpublished items needs the internal API and a session token.
3. **Content profile id** for claim or fact-check items, and whether one exists yet.
4. **Vocabulary ids and qcodes** for verdict, claim type and category, and whether verdict is
   modelled as a `subject` scheme, which is queryable, or an `extra` field, which is not indexed
   by default.
5. **Desk and stage ids** for the fact-checking desk.
6. **Service account** with the `archive` privilege, and the newsroom's agreement to it.
7. **Is `http_push` available,** and can a subscriber and product be configured for
   PromiseTracker? If not, polling is the only inbound path and latency rises to the poll
   interval.
8. **Superdesk version.** The changelog stops at 2.4.5 in 2022 and the codebase is mid-rewrite.
   `content_api/items` still carries a legacy auth shim and a `TODO-ASYNC` on its GET endpoint.
   Pin the version and re-verify the query surface.
9. **Is `extra.*` mapped in Elasticsearch** on this instance?
10. **Do content-list webhooks exist** in the deployed version? They are on `develop` and not in
    the published docs.

### Product

11. **Verdict vocabulary.** v2 inherits Meedan's `unverified / verified / false / misleading`. Is
    that the right set for a promise tracker, where the question is usually whether a promise is
    accurately attributed rather than whether it is true? Worth deciding before the Superdesk
    vocabularies are created.
12. **Status taxonomy and groups.** The five `ClaimStatus.group` values drive every scorecard. An
    editor must assign them before the first claim is published
    ([§9.2](09-launch.md#92-what-has-to-exist-before-anything-else)).
13. **Category taxonomy.** Authored from scratch. v2's free-text values are a starting list, not
    a source.
14. **Claim types.** Are the four in D2 right, and does each need different fields on the public
    page?

### Technical

15. **Map tile provider** and its licence for commercial and embedded use. Blocking for maps.
16. **Boundary data source,** whether geoBoundaries, GADM or national sources, and its
    attribution requirements. Blocking for maps.
17. **GeoJSON simplification** step for large boundaries
    ([§3.9](03-data-model.md#39-geo-d17)).
18. **Search ceiling.** At what volume do MongoDB text indexes stop being adequate, and is Atlas
    Search available on the hosting plan?
19. **Rewrite or refactor** (D12), a separate technical decision.

## 10.4 How to review this specification

1. **Walk the v2.0 reference PDF section by section.** Every section should be carried forward,
   deliberately dropped with a stated reason, or superseded. Flag silent omissions.
2. **Check traceability.** Every "v2 does X" claim should resolve to a real path in the
   repository. Spot-check `src/tasks/extractPromises.ts:189-213`,
   `src/tasks/extractDocuments.ts:19`, `src/collections/Promises.ts:12`,
   `src/plugins/index.ts:93` and `src/lib/security/headers.mjs:53`.
3. **Trace the zero-plugin path on paper:** create country, create actor, upload document,
   extract, review, publish, public page. If any step needs an external service, D4 is broken.
4. **Trace the Superdesk path** with `PT_VERIFICATION=superdesk`, and confirm every field
   crossing the boundary appears in the mapping table in
   [§6.2](06-plugins.md#modelling-a-claim-in-superdesk).
5. **Check each scale target** against [§10.2](#how-each-must-not-break-is-actually-satisfied)
   and reject any row that is an aspiration rather than a mechanism.
6. **Argue with the non-goals** in [§1.6](01-product.md#explicit-non-goals-for-v3). They are the
   cheapest thing to change now and the most expensive later.

## 10.5 Document history

| Version | Date | Change |
|---|---|---|
| 3.0.0-draft.1 | 2026-11-06 | Initial draft. Supersedes *PromiseTracker System Specification v2.0*, a reference architecture that was never implemented |
| 3.0.0-draft.2 | 2026-11-09 | v2 confirmed never live. §9 rewritten from a v2-to-v3 migration into a launch plan: seeding order, retiring Airtable and Check, launch sequence. No data mapping, cutover or redirect map |
| 3.0.0-draft.3 | 2026-11-09 | Editorial pass across all twelve documents before circulation: plainer sentences, no em dashes, less padding, roughly 10% shorter. Added the [review brief](REVIEW.md) as the entry point |
