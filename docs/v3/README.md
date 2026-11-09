# PromiseTracker v3 system specification

Status: draft for review. Version 3.0.0-draft.3, last updated 2026-11-09.

PromiseTracker tracks what politicians and public institutions promise, checks whether those
promises are kept, and publishes the record. v3 is a re-architecture around two ideas.

1. **Everything is a plugin, including the core.** A thin kernel defines the interfaces, a core
   plugin supplies the domain, and every external system is a replaceable adapter.
2. **One site, many countries.** No multi-tenancy. A country is a path segment, as in
   `promisetracker.org/ke/politicians/william-ruto`, not a deployment boundary.

## Why v3

v2 runs, but not without two third-party services.

- **Airtable** holds countries, politicians and source documents, and doubles as the operator
  console. Six pipeline tasks write human-readable status strings back into Airtable cells.
  `Processed = false` in an Airtable view is the work queue. No admin screen can create a
  document.
- **Meedan Check** holds published promises. Nothing in the codebase creates a promise record
  except the Check sync, and `promises.meedanId` is required and unique.

Remove either one and the product stops.

v2 has also never gone live. The code runs, but there is no production data and no public
audience, so v3 inherits no legacy: no data migration, no URL history, no users to carry
through a transition. That is the biggest freedom this re-architecture has, and the reason
[§9](09-launch.md) is a launch plan rather than a migration plan.

Past the coupling, v2 carries structural problems that v3 fixes rather than inherits.

| Problem | Evidence in v2 |
|---|---|
| No promise history, though tracking over time is the whole pitch | `PromiseTimeline` is passed `events={[]}` and renders one synthetic point from `updatedAt` |
| The public site cannot scale | `force-dynamic` on every route, no caching, `depth: 6` queries, `getAllTenants()` re-run many times per render, and a promise list that loads every published promise unpaginated then filters in the browser |
| Search is decorative | `<Search />` renders with no handler. No search route, no index |
| Publication state follows three inconsistent conventions | `tenants.publish` (bool), `political-entities.publish` (bool), `promises.publishStatus` (free text, compared against the literal `"published"`) |
| Multi-tenancy is cosmetic | `userHasAccessToAllTenants: () => true`. Only 3 of 14 collections carry a `tenant`, and `tenant.country` is primary key, display country and subdomain label at once |
| Nothing distinguishes a politician from a ministry or a county | One `political-entities` collection with free-text `region` and `position` |
| `category` is free text | The UI offers filtering by it anyway. No taxonomy collection exists |
| Accented text is destroyed | `cleanText` in `src/tasks/extractDocuments.ts` strips `[^\x00-\x7F]` on a bilingual en/fr product |

## How to read this

Read in order if you are new. Jump to §2, §3 and §6 if you are implementing. If you are
reviewing for the team, start with the [review brief](REVIEW.md), which names the five
decisions worth arguing about and the six questions that need an answer.

| # | Document | For |
|---|---|---|
| 1 | [Product](01-product.md) | Problem, users, jobs to be done, core flows, scope and non-goals |
| 2 | [Architecture](02-architecture.md) | Kernel, plugins, ports and adapters, the plugin contract |
| 3 | [Data model](03-data-model.md) | Every collection and global, field by field |
| 4 | [Governance](04-governance.md) | Publication state, the visibility cascade, roles |
| 5 | [Pipeline](05-pipeline.md) | Ingest, extract, AI, review, publish |
| 6 | [Plugins](06-plugins.md) | Superdesk, native review, AI providers, ingest, Tika |
| 7 | [Public site](07-public-site.md) | Routing, caching, search, SEO, embeds, public API |
| 8 | [Security and operations](08-security-ops.md) | Auth, secrets, SSRF, observability, deployment |
| 9 | [Launch](09-launch.md) | Seeding, retiring Airtable and Check, launch sequence |
| 10 | [Roadmap](10-roadmap.md) | Phasing, scale targets, open questions |

## Decisions this specification rests on

| # | Decision | Argued in |
|---|---|---|
| D1 | Superdesk Core is the fact-check review backend. The newsroom already runs it | [§6](06-plugins.md) |
| D2 | v3 tracks a family of claim types, not only campaign promises | [§3](03-data-model.md) |
| D3 | Plugin-first, ports and adapters, five pluggable seams | [§2](02-architecture.md) |
| D4 | Zero-integration mode is fully usable, on Mongo and S3 and nothing else | [§2](02-architecture.md) |
| D5 | Read-only locking enforces plugin ownership | [§2](02-architecture.md) |
| D6 | For Meedan Check, specify the port and defer the adapter | [§6](06-plugins.md) |
| D7 | Claims have a real, first-class update history | [§3](03-data-model.md) |
| D8 | AI extraction stays, radically simplified | [§5](05-pipeline.md) |
| D9 | Citizen input is native and moderated | [§5](05-pipeline.md) |
| D10 | No multi-tenancy. Country is a path segment and a field | [§7](07-public-site.md) |
| D11 | The public site must fix caching, pagination, search, SEO and distribution | [§7](07-public-site.md) |
| D12 | Rewrite versus refactor is deliberately out of scope here | [§9](09-launch.md) |
| D13 | The core is itself a plugin, and other plugins depend on and extend it | [§2](02-architecture.md) |
| D14 | One `actors` collection with a `kind`: person, party, institution or place. Any actor can make promises | [§3](03-data-model.md) |
| D15 | Typed URL segments: `/ke/politicians/<slug>`, `/ke/places/nairobi` | [§7](07-public-site.md) |
| D16 | No per-country editorial scoping in v3, roles only | [§4](04-governance.md) |
| D17 | Places and politicians carry geodata, and the public site renders maps | [§3](03-data-model.md) |
| D18 | Many sources, many formats. Ingest splits into connectors (where content comes from), content extractors (bytes to text) and structured importers (rows to records) | [§5](05-pipeline.md) |

## Conventions

- **CONFIRM** marks a statement to verify against a running system before implementation.
  [§10](10-roadmap.md#103-open-questions) collects all of them.
- File paths such as `src/utils/ssrf.ts` point at the v2 repository, as evidence or as code to
  reuse. They are not v3 paths.
- "Core" means `plugin-core`, the plugin that ships the domain. See [§2](02-architecture.md).
