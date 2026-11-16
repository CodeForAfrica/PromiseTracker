# PromiseTracker v3 product specification

Draft for team review, 12 November 2026.

This document explains how PromiseTracker v3 will work, in plain terms. The technical detail is in
the full system specification, linked at the end.

## What PromiseTracker is

PromiseTracker records what people in power promise and claim, checks each claim against its
source, and follows what happens to it over time. The public gets one place to see who said what,
whether it happened, and the evidence either way.

Visitors can send in evidence, corrections and updates, but an editor always decides what changes
the record. Some newer trackers let politicians report on themselves or let the public vote. Ours
keeps a newsroom in the loop, and that is the reason to trust a rating here.

## Why we are rebuilding it

The current version runs, but it has four problems we cannot patch.

It depends on outside services. Source documents and politician lists live in Airtable. If
Airtable is unavailable or changes its terms, PromiseTracker stops working.

It does not track anything over time. A promise has a status, but no record of how that status
changed.

The public site will not cope with real traffic. Pages are rebuilt on every visit, the promise
list loads everything at once, and the search box does nothing.

The country setup is confusing. Each country runs as a separate mini-site on its own web address.

The product has not launched yet, so we can fix all four without moving any data.

## How it works

The simplest way to understand v3 is to follow one promise through it.

### 1. Set up a country

An administrator adds a country, its languages, its list of offices, such as President, Governor,
Senator and MP, and its list of areas, such as counties and constituencies. These lists can be
imported from a spreadsheet. Editors pick from them and never type a title or a place by hand,
which keeps filters and comparisons clean.

All countries share one site. A country is part of the web address, as in
`promisetracker.org/en/ke`.

### 2. Add the people and organisations

Editors add the actors whose claims we track. There are three kinds:

- **People**, such as a president, a governor or an MP
- **Parties**, where people vote for a party rather than a person
- **Institutions**, such as a ministry, if an editor decides to track one

Each person has a record of the offices they hold or have held, with dates. That record decides
whether they are in office now or have left office. A candidate's promises can be collected during
a campaign, but the candidate stays off the public site until they win, take office, and an
editor judges there is enough verified material.

When a term ends, the person's page becomes an archived record with a closing summary. Their old
web address keeps working.

### 3. Bring in the source material

Claims come from documents: manifestos, speeches, budgets, policy papers. Editors can bring them in
three ways.

- Upload a file. PDF, Word, Excel, PowerPoint and most other formats work.
- Paste a link, and the system fetches the document.
- Import a spreadsheet. If a partner has already compiled a list of promises, each row becomes a
  claim directly. The editor matches the columns, previews the result, and confirms before
  anything is saved.

Every document shows where it is in the process, along with the reason if something went wrong.

### 4. Find the claims

Reading a 200-page manifesto is slow, so AI does the first pass. It reads the document and
proposes candidate claims, each with the exact quote it found.

Two rules keep this honest. The system throws away any candidate whose quote does not appear word
for word in the document, so the AI cannot invent a claim. And a person reviews every candidate
before it goes further.

AI is optional. A team can enter claims by hand instead, and nothing else changes.

### 5. Verify

Every accepted claim goes to a fact-checker, who confirms it is accurately quoted and attributed.
This happens in one of three places:

- Inside PromiseTracker, in a built-in review queue. This needs no other system.
- In Meedan Check, for teams that fact-check there. The claim appears in the Check workspace, and
  the verdict comes back when the fact-checker publishes the report.
- In Superdesk, for newsrooms that work there. This comes in a later version.

A deployment uses one of them at a time. A claim that fails verification is never published, but
we keep it on record, because a pattern of failures tells us something about the source or the AI.

### 6. Rate it

A rating says how a claim is doing. Editors define the ratings, so the system can grow with new
kinds of claims. Every new installation starts with six ratings for promises, grouped into three
tiers:

| Tier | Ratings |
|---|---|
| Promise kept | Completed, In Progress |
| Uncertain | Unstarted, Inconclusive |
| Promise not kept | Behind Schedule, Stalled |

Every promise starts as Unstarted. A promise needs a deadline before it can be rated Behind
Schedule or Stalled, because both mean behind its own timeline.

Labels can be renamed at any time. A rating's definition can only be reworded, not moved. If the
line between two ratings has to move, the affected claims are re-rated, and the change shows in
their history.

### 7. Publish

Verification and publishing are separate steps. A verified claim with an unfinished summary
should not go live.

Each record has one setting an editor controls: ready, on hold, or archived. A claim appears on the
site only when it is verified, it has a source and a topic, it is marked ready, and everything
above it is ready too. Putting a country, a person or a source document on hold hides every claim
under it within seconds.

Each language is published separately. A claim can be live in English while its French
translation is still being written. A French visitor sees a short "not yet available in French"
note with a link to the English version. English text never appears on a French page.

The system never deletes anything on its own. Archived records stay available for audit.

### 8. Track what happens

This is what makes it a tracker. When something happens, an editor adds an update: the date, the
new rating, a short account, and the evidence. If we got something wrong earlier, the update is
marked as a correction, so readers can see we did not quietly change our minds.

Nobody types in a claim's current rating. The system takes it from the latest published update.
Each claim also shows the date it was last reviewed. When an editor checks a claim and nothing has
changed, they confirm the rating, which moves that date without adding an update.

### 9. Hear from citizens

Each claim page has a form for new evidence, a correction, or a note that something has changed.
Submissions go into a moderation queue and are never shown publicly as they arrive. When a
moderator accepts one, it becomes an update on the timeline, credited to the sender if they agreed
to that.

## What the public sees

**A homepage** that explains PromiseTracker to someone who has never heard of it, using one real
promise with its rating and sources. It also shows a theme chosen by editors, the overall figures,
and the countries we cover.

**A country page** with the headline figure, editors' picks, a comparison of current office
holders, the list of officials, and past administrations.

**A page for each person, party or institution**, opening with what they are responsible for and
the one claim editors consider most important. Then their record, their full list of claims, and
recent changes.

**A page for each claim** with the exact quote, where and when it was said, the deadline, the
rating and when it was last reviewed, the history of ratings, the evidence, and any analysis.

**Area pages** for places that hold several office holders, such as a county.

**Topic and theme pages** that gather claims on one subject, often across countries.

**Search that starts with place.** Typing "Nairobi" returns everyone who represents people there,
from the president down to the local MP. Search also finds names, claims and topics.

The site is built for phones and slow, expensive data. It works in English and French from the
start, editors can add languages, and the layout supports right-to-left languages such as Arabic.

Two rules keep the site honest when there is little data. A section with nothing to show is left
out rather than shown empty. Small numbers are shown as counts, "1 of 3 completed", rather than
percentages that would overstate a thin record.

## Web addresses

Every address starts with the language and the country.

| Page | Example |
|---|---|
| Country | `/en/ke` |
| Person, party or institution | `/en/ke/e/achieng-wekesa` |
| Claim | `/en/ke/p/kibra-housing` |
| Area | `/en/ke/nairobi-county` |
| Seat | `/en/ke/nairobi-county/governor` |
| Topic | `/en/topics/health` |
| Search | `/en/search?q=nairobi` |

A person's address never changes, even after they leave office. A seat's address always leads to
whoever holds that seat today, so after an election `/en/ke/nairobi-county/governor` leads to the
new governor.

## Sharing the work

- **Share previews.** Each page has its own preview image built from its real content, such as a
  claim and its rating, so a shared link shows what it is about.
- **A citation button** on every claim, for journalists.
- **A newsletter sign-up.**
- **Embeds** that let a partner newsroom place a claim card in its own article. These come in a
  later version.

## Who does what

| Role | What they do |
|---|---|
| Contributor | Adds documents, people and draft claims. Cannot publish |
| Reviewer | Reviews AI candidates and verifies claims |
| Editor | Decides what goes public, rates claims and owns their history |
| Moderator | Handles citizen submissions |
| Administrator | Manages users, settings, ratings, lists of offices and areas, and connections to other systems |

One person can hold several roles. Editors also choose the featured claims, themes and key claims
without asking a developer.

## It runs on its own

The core of v3 is a complete product. It needs only a database and file storage. A team can bring
in documents, enter, verify, rate, publish and track claims with nothing else attached.

Everything else is an optional add-on that can be switched on, replaced or removed:

- Meedan Check or Superdesk, for verification in the tool a team already uses
- An AI provider, for finding candidate claims
- A document reader for PDF, Word and other complex formats
- A newsletter service and a privacy-respecting analytics tool

The public website is replaceable too. It ships with the platform, but it reads everything through
a documented interface, so a partner can restyle it, swap a single section, or build their own.

## What we leave out for now

- Superdesk verification
- Separate editing rights per country. Any editor can edit any country at first. This must change
  before a partner newsroom gets an account
- Embeds, maps, and opening the data interface to outside developers
- Accounts for members of the public, petitions, and automatic featuring of officials

## How we will roll it out

**Version 1** does what the current PromiseTracker does, on the new platform, with the new design.
That means document upload and import, AI candidate finding, verification in PromiseTracker or
Meedan Check, ratings and history, citizen submissions, and the public site with search and share
previews.

**Version 2** adds editing rights per country, embeds, maps, and the public data interface.

**Later** brings Superdesk verification and the features listed above.

## The full specification

The full system specification covers the data model, the plugins, the interface, security and
operations. It is in the project repository on the `ft/v3-specification` branch:

https://github.com/CodeForAfrica/PromiseTracker/blob/ft/v3-specification/docs/spec/promisetracker-v3-system-specification.md
