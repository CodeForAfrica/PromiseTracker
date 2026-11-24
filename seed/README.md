# Seed data

Real countries, with their places, offices and office holders, for development. Load them with
one command and the site has pages to work on from the first run.

```bash
pnpm services
pnpm migrate
pnpm seed
```

`pnpm seed ke` loads one country. The seed refuses to run when `NODE_ENV` is `production`, and
when `DATABASE_URL` points at another machine, unless you add `--remote`.

## What is in it

| Country       | Places                                                                                  | Offices                                                              | Office holders                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Kenya, `ke`   | The country and its 47 counties, with their official codes and French and Swahili names | President, Deputy President, Governor, Senator, Woman Representative | The President and Deputy President since 2022, and their predecessors since 2013. The governor of each county, elected in August 2022 |
| Senegal, `sn` | The country and its 14 regions, with French names                                       | President of the Republic                                            | President Bassirou Diomaye Faye, and Macky Sall before him                                                                            |

Both countries also have claims: Kenya's President and Nairobi's governor, and Senegal's President,
each with a title, summary, topic and deadline. They name 12 topics shared by every country, such
as Health and Affordable housing, in `seed/data/topics.csv`. The statements, the exact words, are
left empty, since the seed cannot vouch for a quote.

Each claim links its source: the news report of the pledge, or the manifesto. A claim needs a
source to be public (section 8.1 of the specification), so a claim added here needs one too. Every
link was opened and checked to report the pledge before it was added. Each is marked **verified**, with that
check as its rationale, since only verified claims are public.

Kenya has past holders, so the site shows archived records, successors and "Past administrations".
Senegal is French first, so it shows the site in French. Actors the seed creates are marked ready,
so they appear on the site at once.

The office holders are real public officials. The list was compiled without checking each row
against an official source, so check a name against the Independent Electoral and Boundaries
Commission, the county's own site or the Gazette before relying on it, and fix it here if it is
wrong. Senators, Woman Representatives and MPs are not seeded yet.

## How it works

Each country is a folder in `seed/data`, holding one spreadsheet per record type:
`offices.csv`, `areas.csv`, `actors.csv`, `terms.csv` and `claims.csv`. They are in the format editors import
(`docs/admin-guide.md`, section 7), and `pnpm seed` loads them through the same import, so they are
checked the way an editor's file is.

- **It is safe to run again.** Each row matches the record it made before, by slug, or for a term
  by its actor, office, area and start date. A second run changes nothing. A changed row updates
  its record.
- **It adds, and never removes.** A country that already exists keeps its settings. If it is not
  ready, the seed says so, since its pages will not show. Actors the seed creates are saved ready,
  in the same step, so an interrupted run never leaves one on hold. An actor that exists keeps its
  status, so one you held stays held. Records you added by hand are left alone. To start again, empty the database: `pnpm services:down`, remove
  the Postgres volume, then `pnpm services` and `pnpm migrate`.
- **It loads in order:** the shared topics first, then for each country offices, areas, actors,
  terms and claims, because each names records loaded before it.

`seed/seed.ts` holds the loader. `tests/unit/seed.unit.spec.ts` checks every row without a
database, and `tests/int/seed.int.spec.ts` loads it all into the test database.

## Adding seed data with a feature

A feature that adds a record type, or a field the site shows, adds seed data in the same pull
request, so the next person sees it working without entering anything.

1. Add a spreadsheet, or columns, to each country in `seed/data` the feature applies to. Use real,
   public data, and say in the pull request where it came from.
2. If it is a new record type, add it to `SEED_ORDER` in `seed/seed.ts`, after the records it
   names, and make sure the import can read it.
3. Extend `tests/int/seed.int.spec.ts` to check that the new data reaches the site.
4. Update the table above.

To add a country, add its folder in `seed/data` with all four spreadsheets, and add its code to
`SEED_COUNTRIES` in `seed/seed.ts`.
