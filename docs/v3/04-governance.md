# 4. Governance

How a record becomes public, who may do what, and what happens when something is pulled down.

## 4.1 The problem this solves

v2 expresses publication three incompatible ways. `tenants.publish` is a boolean set by a sync
task and read-only to editors. `political-entities.publish` is the same. `promises.publishStatus`
is a free-text field compared against the string literal `"published"` in both the access rule
(`src/collections/Promises.ts:12`) and the listing query. Nothing connects them. Putting a
country on hold does not hide the politicians under it, and a typo in `publishStatus` silently
unpublishes a promise.

v3 has one writable field and one computed one.

## 4.2 recordStatus and _status

`recordStatus` captures intent. It is the only publication field a human writes.

| Value | Meaning |
|---|---|
| `ready` | This record is, on its own terms, fit to publish |
| `hold` | Not ready, or temporarily withdrawn. Default for claims and claim updates |
| `archived` | Retired. Preserved for audit, never public, never auto-deleted |

`_status` captures the outcome. It is Payload's own draft and published state, computed and
never set directly. The rule below is the whole of it.

```
record._status = 'published'  ⟺  record.recordStatus === 'ready'
                                 ∧ every ancestor's recordStatus === 'ready'
                                 ∧ (claims only) verification.verdict === 'verified'
                else 'draft'
```

### Ancestry

| Record | Ancestors that must all be `ready` | Extra condition |
|---|---|---|
| `Country` | none | none |
| `Actor` | country | none |
| `Document` | country | none |
| `Claim` | country, promisor, source document when set | `verification.verdict === 'verified'` |
| `ClaimUpdate` | country, promisor, claim | none |
| `Submission` | never published | none |

A claim's source document counts as an ancestor because the document is the evidence. If a
manifesto is withdrawn as inauthentic, every promise extracted from it has to vanish with it. In
v2 nothing would have happened at all.

### Why two fields

A single "published" checkbox cannot express "this promise is fine but the document it came
from is under review". With two fields, intent survives the cascade. A promise an editor held
individually stays held when its parent is released, and a promise that was hidden only because
its parent was held comes back automatically. There is no blanket "set all descendants to
ready", because that would silently override a human's decision.

## 4.3 The cascade

An `afterChange` hook fires when `recordStatus` changes on any collection.

1. Recompute `_status` for the changed record, synchronously. The save returns immediately with
   the record correct.
2. Enqueue a background job to walk descendants and recompute each one independently from its
   own `recordStatus` plus the refreshed ancestry.
3. On completion, call `revalidateTag` for every affected cache tag
   ([§7.2](07-public-site.md#72-caching)).

Downward, when a parent goes to `hold` or `archived`, every descendant recomputes to `draft`
whatever its own intent, and the subtree leaves the public site within seconds.

Upward, when a parent returns to `ready`, each descendant recomputes from its own
`recordStatus`, so individually held records stay held.

A status change never triggers re-extraction, re-verification or any other pipeline work.
Existing claims stay valid. Only their visibility moves.

Because `_status` is always accurate in the database, every public query stays trivial, with no
ancestry joins and no `$lookup`.

```ts
await payload.find({
  collection: 'claims',
  where: { and: [{ _status: { equals: 'published' } }, { country: { equals: countryId } }] },
})
```

### Scale note

A country with 5,000 claims and 20,000 updates cascades in one background job with batched bulk
updates rather than one write per record. The job is idempotent, safe to re-run, and reports
counts to Sentry. For very large subtrees it chunks and checkpoints, so a restart resumes
rather than starts over.

## 4.4 Deletion

No sync, import or plugin ever hard-deletes a record. Upstream deletion maps to
`recordStatus: archived`. Hard deletion is an explicit admin action, taken after review, on a
record the admin has looked at.

The reason is concrete. Deleting a document that has extracted claims, human verification
decisions and a published timeline destroys irreversible work, and upstream systems are
unreliable about announcing deletions in the first place.

## 4.5 Roles

Roles are additive. A user with `contributor` and `reviewer` can do both.

| Role | Purpose |
|---|---|
| `super-admin` | Full access. Manages users, settings, plugin credentials and taxonomies. The only role that can override a plugin-owned field, and that override is audit-logged |
| `editor` | Final content authority. Full `recordStatus` control on every collection. Owns the claim timeline |
| `contributor` | Adds actors, documents and draft claims. Cannot publish, and may set `recordStatus` to `hold` only |
| `reviewer` | Triages extraction candidates and sets `verification.verdict`. Disabled when a verification plugin owns that field |
| `moderator` | Works the submissions queue, and may promote an accepted submission to a claim update |
| `viewer` | Read-only |

### Permission matrix

| Action | super-admin | editor | contributor | reviewer | moderator | viewer |
|---|---|---|---|---|---|---|
| Create or update countries | ✓ | ✓ | | | | |
| Create or update actors | ✓ | ✓ | ✓ | | | |
| Create or update documents | ✓ | ✓ | ✓ | | | |
| Create claims manually | ✓ | ✓ | ✓ | | | |
| Accept or reject extraction candidates | ✓ | ✓ | | ✓ | | |
| Set `verification.verdict` | ✓ | ✓ | | ✓ | | |
| Create or update claim updates | ✓ | ✓ | | | ✓ from a submission | |
| Set `recordStatus` | any value | any value | `hold` only | on claims, any | | |
| Moderate submissions | ✓ | ✓ | | | ✓ | |
| Hard-delete | ✓ | ✓ | | | | |
| Override a plugin-owned field | ✓, logged | | | | | |
| Manage users and settings | ✓ | | | | | |
| Read all records | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Plugin and role symmetry

When a plugin owns a capability, the matching in-CMS role loses it, so two sources of truth
never exist.

| Active plugin | Capability it takes | Effect |
|---|---|---|
| `plugin-superdesk` | `verification.verdict` | `reviewer` can no longer set a verdict in the admin, because Superdesk is the review authority. Candidate triage stays in PromiseTracker |
| `plugin-airtable` | Document and actor intake | `contributor` creation of those records is disabled, because Airtable is the entry point |

The claim timeline is always editorial, whichever plugins are active.

## 4.6 What v3 does not do (D16)

There is no per-country editorial scoping. Any authenticated user with a write role can edit any
country's records. `User.countries` exists in the schema as an unenforced relationship.

This is a deliberate choice for a single in-house team, and it is the right trade while that
stays true. It stops being right the moment a partner newsroom gets an account, because nothing
would prevent a Kenyan contributor from editing South African records, deliberately or by
accident.

Turning it on later is a `where` clause in the collection access functions plus a field-level
guard, with no migration. The relationship is already there, and country is already a required,
indexed field on every content collection.
[§10](10-roadmap.md#phase-2-scale-and-assist) tracks it as the first thing to add when the user
base widens.

v2's position was worse but less honest. It ran `@payloadcms/plugin-multi-tenant` with
`userHasAccessToAllTenants: () => true`, which looks like isolation and provides none.

## 4.7 Audit

| Event | Recorded where |
|---|---|
| Any `recordStatus` change | Payload version history, plus a structured log with actor, record, old and new value |
| `verification.verdict` change | Version history, plus `verifiedBy` and `verifiedAt` on the record |
| Candidate accept or reject | `Candidate.reviewedBy`, `reviewedAt`, `rejectedReason` |
| Submission moderation | `moderatedBy`, `moderatedAt`, `moderatorNote` |
| Super-admin override of a plugin-owned field | Structured log at `warn` plus a Sentry breadcrumb, with before and after |
| Plugin sync writes | The plugin's own `lastSyncedAt`, `lastSyncStatus` and `lastSyncError` group |

Claims and claim updates have versions enabled, so "what did this page say in March?" is
answerable without a separate audit store.

## 4.8 Admin notifications

Status fields in the admin are the primary, mandatory feedback layer. Email is secondary, and
only where a human can act.

| Event | Notify? | Why |
|---|---|---|
| Any record moved to `archived` | Yes | May warrant a hard delete, and downstream work should be reviewed |
| Country moved to `hold` | Yes | Hides everything beneath it, and is easy to do by accident |
| Actor or document moved to `hold` | No | Routine, and visible in the admin's draft list |
| `archived` back to `ready` | Yes | Un-archiving is deliberate and should be acknowledged |
| Document processing failed after the retry budget | Yes, to the uploader | They can fix the file or the link |
| Extraction flagged `needs-review` | In-app only | Visible in the review queue |
| New submission | Digest, to moderators | Volume-dependent, so not per item |
| Infrastructure failure | No email | Goes to Sentry, and there is nothing an editor can do |
