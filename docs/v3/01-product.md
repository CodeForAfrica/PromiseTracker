# 1. Product

## 1.1 The problem

Politicians make promises to win support, and nobody revisits them. Information is not the gap.
Manifestos, budget speeches and policy statements are all public. The gap is that nobody keeps
the record in one place, over time, with evidence attached.

Journalists and civil-society watchdogs do this work today in spreadsheets and documents that
nobody outside the newsroom sees, that fall out of date within months, and that cannot be
queried, embedded or compared across countries.

PromiseTracker makes that record durable, public and defensible.

## 1.2 What v3 is

One public site covering many countries. Anyone can look up a politician, a party, a ministry
or a county and see:

- every promise attributed to them, with the exact quote and a link to the source document
- the current status of each promise, and how that status changed over time, with evidence
- who verified it, when, and on what basis

Behind it sits an editorial system where a small team ingests source material from many places
and formats, uses AI to find candidate promises, verifies them in whichever tool the newsroom
already uses, and publishes. No spreadsheet anywhere in the loop.

## 1.3 Who it is for

### Public audiences

| User | What they need | What v3 gives them |
|---|---|---|
| Citizen | What did the person I voted for promise, and did they do it? | A politician profile with a scorecard, promise list and per-promise timeline |
| Journalist | A checkable fact, fast, with provenance | Promise pages with source quotes, document links and the verification record, plus an embeddable widget and a read-only JSON API |
| Researcher or CSO | Comparable data across politicians, regions and time | Filterable listings, bulk export, the public API |
| Partner newsroom | To put the tracker in front of their own audience | Embeddable scorecards and promise cards |

### Internal users

| Role | Job |
|---|---|
| Contributor | Adds source documents and actors, prepares records, cannot publish |
| Reviewer or fact-checker | Triages AI-extracted candidates, verifies claims, records verdicts |
| Editor | Decides what goes public, owns promise updates and the timeline |
| Moderator | Triages citizen submissions |
| Administrator | Manages users, integrations, credentials and taxonomies |

## 1.4 Jobs to be done

The system's obligations, in priority order.

1. **Get source material in, whatever shape it arrives in.** A manifesto PDF, a Word policy
   paper, a budget spreadsheet, a CSV of promises a partner already compiled, a URL to a speech
   transcript. ([§5](05-pipeline.md))
2. **Turn a document into candidate promises without reading all 200 pages.** AI proposes, a
   human disposes, and nothing reaches the public unreviewed. ([§5](05-pipeline.md))
3. **Verify a claim in the tool the newsroom already works in.** Superdesk for this newsroom,
   the Payload admin for a team that has nothing. ([§6](06-plugins.md))
4. **Record what happened, when, and how we know.** Not a status field. A dated history with
   narrative and evidence. This is the product.
   ([§3](03-data-model.md#35-claim-updates))
5. **Publish safely.** One switch controls visibility, and hiding a document immediately hides
   everything underneath it. ([§4](04-governance.md))
6. **Stay fast and findable under load,** on election day, linked from a national broadcaster.
   ([§7](07-public-site.md))
7. **Let the work travel,** through embeds, a public API, bulk export, and structured data for
   search engines and AI assistants. ([§7](07-public-site.md))
8. **Add a country without writing code.** ([§7](07-public-site.md#71-routing))

## 1.5 Core flows

### A. Publishing a promise

```
Add actor ──► Add document ──► Extract text ──► AI proposes candidates
                                                        │
                                                        ▼
                                          Reviewer accepts / rejects
                                                        │
                                              accepted  ▼
                                                   Claim (draft)
                                                        │
                                       verify (native admin OR Superdesk)
                                                        │
                                                        ▼
                                            Editor marks ready ──► PUBLIC
```

Every step is visible in the admin. A document's position in the pipeline is one field, not
something inferred from which relations happen to be populated.

### B. Updating a promise over time

This is what makes it a tracker. An editor adds a claim update: a date, the status as of that
date, a short narrative, and one or more pieces of evidence. The promise's current status comes
from the most recent published update and is never typed in directly. The public page renders
the full history as a timeline.

A citizen submission that survives moderation becomes a claim update, with attribution.

### C. Citizen submission

```
Public "Submit an update" form  ──►  Submission (unpublished, rate-limited, captcha)
                                            │
                                     moderator reviews
                                            │
                            accepted ───────┴─────── rejected / spam
                                │
                                ▼
                        becomes a Claim update
```

Submissions are never published directly and are never visible to the public.

### D. Adding a country

An administrator creates a country record with an ISO code and a name. It immediately has a
landing page at `/{code}`, listings for each actor type, and a sitemap. No deployment, no
configuration, no new Airtable base.

## 1.6 Scope

### In scope for v3

- Countries, actors (politicians, parties, institutions, places), claims, claim updates,
  documents, categories, statuses, citizen submissions, media
- Multi-format, multi-source ingest, and AI-assisted extraction with human review
- A pluggable verification backend, with Superdesk and a native in-admin reviewer
- The public site: country and actor pages, filterable claim listings, claim pages with
  timeline and map, search
- Embeddable widgets and a read-only public JSON API
- Bulk CSV export
- English and French

### Explicit non-goals for v3

Named so nobody has to guess, and so the data model can take them later.

| Non-goal | Why | Left open how |
|---|---|---|
| Per-country editorial permissions | D16. One in-house team for now | Roles exist, and a `countries[]` filter can be added without migration ([§4](04-governance.md#46-what-v3-does-not-do-d16)) |
| Custom domains per country | Not needed. Path segments cover it | Routing resolves country from the path, so a domain-to-country map is additive |
| Per-country theming | One brand today | Branding fields live on the country record |
| Public user accounts | No bookmarking, alerts or profiles | Submissions are anonymous with optional contact |
| Real-time collaborative editing | Payload's document locking is enough | |
| Automated promise tracking from news | Needs a reliable corpus and far more verification | The connector port would host it ([§5](05-pipeline.md#52-source-connectors)) |
| Crowdsourced verification | Verification stays with accountable fact-checkers | Submissions carry evidence, and a human decides |
| Elasticsearch or Algolia | MongoDB text search is adequate at the target volumes | One module isolates the search layer ([§7](07-public-site.md#73-search)) |

## 1.7 How success is measured

| Dimension | Measure | Target |
|---|---|---|
| Editorial throughput | Median time from document upload to first published promise | < 1 working day |
| Review burden | Share of AI candidates accepted without edits | > 50% |
| Freshness | Share of published promises with an update in the last 6 months | > 70% |
| Reach | Embeds served, API requests, referrals from search | Trending up |
| Onboarding | Time to stand up a new country | < 1 hour, by a non-developer |
| Resilience | p95 page load under 10x normal traffic | < 2.5s LCP |
| Independence | External services required to run the system | 0 |

The last row matters most. It is the measure v2 fails.
