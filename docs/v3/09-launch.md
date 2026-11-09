# 9. Launch

## 9.1 There is no data migration

PromiseTracker has never gone live. v2 holds no production content, and every record in v3 will
be entered fresh. That one fact deletes most of what a section like this normally contains.
There is no field mapping, no reconciliation, no dual-running, no freeze window, no redirect
map, and no one-off migration scripts to write, test and then throw away.

Three much smaller things remain.

1. **Seeding** the handful of configuration records everything else hangs off, in the order they
   have to exist ([§9.2](#92-what-has-to-exist-before-anything-else)).
2. **Retiring Airtable and Meedan Check as tools,** which means revoking credentials and
   deleting code, not moving data ([§9.4](#94-retiring-the-integrations)).
3. **Deciding, table by table, whether anything curated in those tools is worth re-entering** as
   ordinary day-one content ([§9.3](#93-content-the-old-tools-hold)).

Not in scope (D12): whether v3 is built by refactoring this repository in place or in a fresh
one. That remains a separate technical decision. Worth noting, though, that with no data to
carry across, the usual argument for refactoring in place, that the migration is cheaper if the
schema evolves, no longer applies. The cost of either option is now almost entirely about code
reuse ([§2.7](02-architecture.md#27-reused-from-v2)), not data.

## 9.2 What has to exist before anything else

An empty v3 is not immediately useful. A few collections are referenced by everything else and
have to be authored first. This is the dependency order, and also the order a new country is
onboarded in ([§1.5](01-product.md#15-core-flows)).

| Order | Collection | Who authors it | Why it must come first | Minimum to launch |
|---|---|---|---|---|
| 1 | `claim-statuses` | Editorial lead, once | Every claim update points at one, and `group` drives every scorecard | One full set, every record with a `group` |
| 2 | `categories` | Editorial lead, once | Claims filter and chart by category | 8 to 15 categories, localized |
| 3 | `countries` | Super-admin | The first path segment. Nothing public resolves without one | One per country at launch |
| 4 | `users` | Super-admin | Roles gate every other step | One super-admin, one editor per country |
| 5 | `site-settings` | Super-admin | Navigation, footer, branding | Enough for a page to render |
| 6 | `actors` | Editor, per country | Claims need a promisor | The politicians being tracked at launch |

Only then do documents, extractions and claims make sense, and those follow the ordinary
pipeline ([§5](05-pipeline.md)) rather than any special import path.

`ClaimStatus.group` is the one that bites. It has no obvious default and no upstream source, and
scorecards come out wrong rather than empty if it is missing or inconsistent. Assign it
deliberately, once, before the first claim is published, not retrospectively
([§10.3](10-roadmap.md#103-open-questions), question 12).

## 9.3 Content the old tools hold

Not live is not the same as empty. The Airtable base and the Check workspace hold work people
actually did, and each table deserves an explicit keep-or-drop decision rather than quiet
abandonment.

| Where | What it is | Recommendation |
|---|---|---|
| Airtable `CSO Promise Updates` | Crowd-sourced promise updates, prefilled by the embedded public form. No v2 code has ever read this table | Triage by hand into `submissions` or `claim-updates`, or drop it as a decision. This is contributed content, and losing it silently is the bad outcome |
| Airtable entity and country tables | Curated lists of politicians, offices and regions | Re-enter, or import as CSV. Note that v2's sync skipped any entity without an image or term dates, so Airtable is the fuller list, not v2 |
| Airtable document rows | Source manifestos and their URLs | Re-upload the files and re-enter the metadata |
| Check workspace | Claims and reports created during pilots | Review for anything worth keeping. Verdicts do not transfer, because a v3 claim is verified in v3 |

Where a list is long enough to be worth not retyping, the route in is the structured importer
([§5.6](05-pipeline.md#56-structured-import)), using the same mapping, preview and commit flow a
partner newsroom's spreadsheet uses. That is deliberate. It means this work needs no bespoke
migration code, and it exercises the importer before an outside party does.

Nothing arriving this way carries an `airtableID`, a `meedanId` or a `checkMediaId`. Those
fields do not exist in v3 ([§3](03-data-model.md)).

## 9.4 Retiring the integrations

With no data to reconcile, both integrations are removed rather than wound down.

### Airtable

1. Decide the fate of each table ([§9.3](#93-content-the-old-tools-hold)) and import anything
   being kept.
2. Revoke the API key.
3. Delete `/api/airtable-upload` and its bearer token, the Airtable tasks and workflow, the
   generated typings, `pnpm generate:airtable`, and the `settings.airtable` group.
4. Archive the base read-only rather than deleting it, for a few months.

Teams that genuinely want to keep working in Airtable can run `plugin-airtable` instead
([§6.6](06-plugins.md#66-plugin-airtable-optional-and-not-required)). It is an option, not the
default, and either way the work queue no longer lives there.

### Meedan Check

1. Revoke the API key.
2. Delete `/api/meedan-sync`, `WEBHOOK_SECRET_KEY`, `src/lib/meedan.ts`,
   `src/lib/syncMeedanReports.ts`, the three sync tasks and their workflow, and the
   `settings.meedan` group.
3. Delete `scripts/dedupe-meedan-promises.ts` and the `checkSyncMetadata` global.
4. Drop `promises.meedanId` and `ai-extractions.checkMediaId` with the collections themselves.

The `meedanId` hazard that script exists for, where `meedan-sync` only ever backfills a missing
`meedanId` and never overwrites one because overwriting orphaned records in the past, is a
property of v2's data and disappears along with that data. It is recorded here only so nobody
reintroduces the same join-on-a-foreign-id pattern. In v3 a claim is identified by its own id,
and a verification backend's identifier is a plugin-owned field it may not repurpose
([§2.5](02-architecture.md#25-ownership-and-single-source-of-truth-d5)).

## 9.5 URLs

The v2 scheme, `ken.promisetracker.org/william-ruto`, and the v3 scheme,
`promisetracker.org/ke/politicians/william-ruto`, share nothing. With no public launch behind it
there is no URL history to preserve and no redirect map to build.

One thing to confirm before launch: whether any v2 subdomain has been publicly reachable long
enough to be indexed or linked from anywhere. If it has, a redirect map costs little and is
worth having. If it has not, which is the expected answer, nothing is owed and the new sitemap
is simply the first one.

The single-origin design is worth stating on its own merits, independent of any move. One origin
instead of one per country means one TLS certificate, one CDN configuration, one cookie domain,
shared caching, and cross-country pages that are possible rather than impossible.

## 9.6 Launch sequence

| Phase | What happens | Exit |
|---|---|---|
| 0. Stand up | Deploy v3 with Mongo, S3, a domain and monitoring. Boot validation green with `PT_PLUGINS=core` alone | Health endpoint green, and an editor can sign in |
| 1. Seed | Author statuses and groups, categories, the first country, users, site settings | §9.2 complete, and a page renders |
| 2. Editorial pilot | Real documents through the real pipeline: upload, extract, review, publish, with the site not yet public | Editors have published a country's worth of claims and are not asking for workarounds |
| 3. Public launch | Site public, sitemap submitted, submission form open | Traffic served from cache, search works, no errors above baseline |
| 4. Observe | Watch queues, cache hit rate and moderation volume for two weeks | Stable, and the submission backlog is being worked |

There is no parallel run, no freeze and no DNS rollback, because there is nothing live to run
alongside, freeze or roll back to. The rollback for phase 3 is to not launch yet, which is the
cheapest rollback there is, and a good reason not to compress phase 2.

Superdesk is not on this path. It arrives in Phase 3 of the roadmap
([§10.1](10-roadmap.md#phase-3-the-newsroom)), after launch, by switching `PT_VERIFICATION` from
`native`. Claims verified natively before that point keep their verdicts, and the adapter takes
over new ones. Launching does not wait on someone else's instance.

## 9.7 What to verify before going public

1. The system runs with `PT_PLUGINS=core` alone: no Superdesk, no AI, no Tika, no credentials in
   the environment. If it does not, D4 is broken.
2. Every `claim-status` record has a `group`, and the groups add up to the scorecard an editor
   expects.
3. Every claim's `currentStatus` is derived from a published update, never typed into a field
   ([§3.5](03-data-model.md#35-claim-updates)).
4. A French document, uploaded to v3 and processed by v3, renders with correct diacritics. This
   is the forward test for the fixed extractor
   ([§2.7](02-architecture.md#one-bug-to-fix-not-port)).
5. An unpublished country hides every claim beneath it, and publishing it reveals them within
   the revalidation window ([§4.3](04-governance.md#43-the-cascade)).
6. Claim pages carry valid ClaimReview JSON-LD and canonical URLs, and the sitemap resolves.
7. No claim is publicly visible without a verdict.
8. The Airtable `CSO Promise Updates` backlog has been triaged or dropped on purpose.
