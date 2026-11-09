# Start here: review brief

PromiseTracker v3 specification, draft 3.0.0-draft.3, circulated 2026-11-09.

Comments by: _[date]_. Decision meeting: _[date]_.

The spec is detailed on purpose. The expensive mistakes in a system like this get made in the
first month and paid for over three years. You are not being asked to read all of it.

## What we are asking for

Three things, in order of how much they are worth.

1. **Argue with the five decisions in §A.** They are cheap to change this week and expensive to
   change after Phase 1.
2. **Answer the question next to your name in §B.** Three of the six block work, and one blocks
   launch.
3. **Tell us what is missing** about how you actually work. Specifics beat approval.

We are not asking about wording, visual design or the phase dates. Those change cheaply later.

## How much to read

| If you are | Read | Time |
|---|---|---|
| Anyone, minimum | This brief | 10 min |
| Programme or editorial lead | [§1 Product](01-product.md), [§4 Governance](04-governance.md), [§9 Launch](09-launch.md) | 40 min |
| Fact-checker or editor | [§1.5 Core flows](01-product.md#15-core-flows), [§5 Pipeline](05-pipeline.md), [§3.4 and §3.5 statuses and updates](03-data-model.md#34-claim-statuses) | 30 min |
| Developer | [§2 Architecture](02-architecture.md), [§3 Data model](03-data-model.md), [§6 Plugins](06-plugins.md) | 90 min |
| Ops or security | [§8 Security and operations](08-security-ops.md), [§2.4 Mode matrix](02-architecture.md#24-mode-matrix) | 20 min |

If you read one page beyond this brief, read [§1 Product](01-product.md).

## The short version

Two ideas carry the design.

- **Everything is a plugin, including the core.** A thin kernel defines five interfaces, a core
  plugin supplies the whole domain, and Superdesk, each AI vendor, Tika and Airtable are
  replaceable adapters behind those interfaces.
- **One site, many countries.** No multi-tenancy. A country is a path segment, as in
  `promisetracker.org/ke/politicians/william-ruto`, not a deployment.

The test v3 has to pass: the system runs end to end with no external service at all. No
Superdesk, no AI key, no Airtable, no Meedan Check. Today v2 stops working if you remove
Airtable or Check, which is why the last row of
[§1.7](01-product.md#17-how-success-is-measured) counts required external services and sets the
target at zero.

Nothing needs migrating. The product has never gone live, so [§9](09-launch.md) is a launch
plan.

## A. Five decisions worth arguing about

The [spec index](README.md) records eighteen decisions. These five are where being wrong costs
the most.

### A1. One pipeline for four claim types

Manifesto promises, policy pledges, budget commitments and public statements all run through one
pipeline and one review queue.

- **Gain.** No second system later for the things that are not quite promises.
- **Cost.** Every public page has to read sensibly for four types, and "kept" or "broken"
  language does not fit a one-off statement.
- **Changes our mind.** The newsroom only ever wants manifesto promises. Then `type` disappears
  and §3.3 and §7 get simpler.

### A2. No multi-tenancy. Country is a path segment

- **Gain.** One origin, one certificate, one cache, one cookie domain. Cross-country comparison
  pages become possible, and v2's `userHasAccessToAllTenants: () => true` stops being a lie.
- **Cost.** No per-country domain and no per-country theme. A country cannot be handed to a
  partner as their own site.
- **Changes our mind.** A funder or partner contractually requiring their own branded domain.

### A3. No per-country editorial scoping at launch

Roles exist, but any account can edit any country's data.

- **Gain.** Ships sooner, and it is genuinely enough for one in-house team.
- **Cost.** The first partner newsroom cannot be given an account safely.
- **Changes our mind.** A partner gets an account before Phase 2, which moves this into Phase 1.
  It is a `where` clause and a field guard, not a migration, which is why
  [§10.1](10-roadmap.md#phase-2-scale-and-assist) puts it first in Phase 2 rather than last.

### A4. The core is itself a plugin

- **Gain.** One extension API, used by core before anyone else, so no integration is a special
  case. Any adapter can be deleted without unpicking the domain.
- **Cost.** Indirection in places that would otherwise be direct, a slower first month, and a
  discipline the team has to keep.
- **Changes our mind.** We are certain we will only ever run one verification backend and one AI
  provider. The abstraction is not free and should not be bought on a maybe.

### A5. Superdesk verifies, and Check is specified but not built

- **Gain.** Fact-checkers work where they already work, and Check's roughly 2,000 lines leave
  the codebase.
- **Cost.** Ten unknowns that live on someone else's instance
  ([§10.3](10-roadmap.md#103-open-questions)), and an integration nobody can fully test until
  the newsroom configures it.
- **Changes our mind.** The native review queue proves good enough during the Phase 2 pilot,
  making Superdesk optional rather than planned.
- Launch does not wait on this. Superdesk is Phase 3, after going live
  ([§9.6](09-launch.md#96-launch-sequence)).

## B. Six questions that need an answer

| # | Question | Who can answer | Blocks |
|---|---|---|---|
| B1 | **Status taxonomy and the five groups.** `ClaimStatus.group` drives every scorecard and has no sensible default | Editorial lead | Launch |
| B2 | **Category list.** 8 to 15, localized, authored from scratch | Editorial lead | Launch |
| B3 | **Verdict vocabulary.** v2 inherited Meedan's `unverified / verified / false / misleading`. For a promise tracker the question is usually whether a promise is accurately attributed, not whether it is true | Editorial lead | Superdesk vocabularies |
| B4 | **The ten Superdesk instance details** ([§10.3](10-roadmap.md#103-open-questions), Q1 to Q10): API prefix, content profile, vocabularies, desk ids, service account, and whether `http_push` exists | Whoever administers the instance | Phase 3 |
| B5 | **Map tiles and boundary data,** and their licences for commercial and embedded use | Tech lead | Maps in Phase 2 |
| B6 | **Rewrite or refactor,** deliberately left out of the spec. With no data to migrate this is now almost purely a code-reuse question ([§2.7](02-architecture.md#27-reused-from-v2)) | Tech lead | Phase 1 start |

Answer B1 first. It is small, it is editorial, and scorecards come out wrong rather than empty
if it is inconsistent.

## C. Already decided, and deliberately out of scope

Arguing with these is cheap now and expensive later, so argue now. They were chosen, not
overlooked, and [§1.6](01-product.md#explicit-non-goals-for-v3) gives the reasoning.

Out of scope for v3: custom domains per country, per-country theming, public user accounts with
bookmarking or alerts, real-time collaborative editing, automated promise detection from news,
crowdsourced verification where citizens decide rather than submit evidence, and Elasticsearch
or Algolia.

Each one is left open in the data model, so it can be added later without a migration.

## D. What useful feedback looks like

"Looks good" tells us nothing. These questions do.

- Where does this make your job harder than it is today?
- What have we assumed about your workflow that is not true?
- What would you end up doing by hand that you expected the system to do?
- Which target in [§1.7](01-product.md#17-how-success-is-measured) is wrong, and what is the
  real number?
- What breaks on election week, when half a year's traffic arrives in three days?

Comment inline wherever you are reading this, or reply in the thread. A sentence on one real
problem is worth more than a pass over all eleven documents.
