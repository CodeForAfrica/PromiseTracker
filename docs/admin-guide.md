# Admin guide

How to set up PromiseTracker in the admin, at `/admin`. It covers what the admin can do today and
grows as features land. The [system specification](spec/promisetracker-v3-system-specification.md)
explains the rules behind each step.

## Contents

1. Signing in
2. Users and roles
3. Languages
4. Countries
5. Areas and offices
6. Importing from a spreadsheet
7. Area outlines
8. Site settings
9. When changes appear on the site

The admin's menu groups record types by what they are for:

| Group          | Holds                                             |
| -------------- | ------------------------------------------------- |
| Places         | Countries, Areas, Offices, Boundaries             |
| Media library  | Images, such as actor photos                      |
| Imports        | Imports, Saved mappings                           |
| Administration | Users, and plugin settings once a plugin has some |
| Public site    | Site settings                                     |

## 1. Signing in

Sign in at `/admin` with your email address and password. Five wrong passwords lock the account
for fifteen minutes.

**The first super-admin** is not created in the admin. Whoever runs the server sets two
environment variables before the first start, and the account is created when no user exists:

```bash
PT_ADMIN_EMAIL=you@example.org
PT_ADMIN_PASSWORD=a-password-of-at-least-12-characters
```

Nobody can register through the admin. A super-admin adds everyone else.

**A forgotten password.** Until an email provider is set up, a reset email goes only to the server
log. Ask a super-admin to set a new password: Administration > Users, open the user, and type a new
one.

## 2. Users and roles

Administration > Users > Create New. Give the person a name, an email address, a password and one
or more roles. A person can hold several roles.

| Role        | Can                                                                          |
| ----------- | ---------------------------------------------------------------------------- |
| super-admin | Everything: users, countries, areas, offices, imports of places, settings    |
| editor      | Decide what is public, rate claims, edit site settings and editorial content |
| contributor | Add actors, documents and draft claims. Can hold a record, not publish it    |
| reviewer    | Review AI candidates and set verdicts                                        |
| moderator   | Handle citizen submissions                                                   |
| viewer      | Read the admin, change nothing                                               |

Only a super-admin can give roles. The last super-admin cannot be deleted or lose the role, so the
system always has someone who can manage users.

**Countries** on a user is a list of the countries they work on. Version 1 records it but does not
limit editing by it.

## 3. Languages

The site runs in the languages the `PT_LOCALES` setting switches on, such as `en,fr`. English is
always on. Five languages are registered: English, French, Portuguese, Arabic and Swahili. Adding
another needs a developer.

**Editing in another language.** Use the language menu at the top right of the admin. Fields marked
with a language, such as "Name — Français", hold one value per language. Switch language, type the
translation and save. Fields without a language mark hold one value for every language.

A record is public in a language only when its required fields have a value in that language. A
missing translation is never filled with English on the site. The site shows a short "not available
in this language" notice with links to the languages the page has.

## 4. Countries

Only super-admins manage countries. Places > Countries > Create New.

1. **Country:** choose it from the list of African countries.
2. **Save.** The name fills in, in every language, along with the region and the languages the
   country usually publishes in.
3. **Check the languages** and the default language, and change them if needed.
4. **About:** a short description, per language. Optional.
5. **Record Status,** in the sidebar: leave it on **hold** while you set the country up. Set it to
   **ready** to make it public.

Once saved, the country cannot be changed, because its code is part of every address, such as
`/en/ke`. The code and region show in the sidebar.

**Published In,** in the sidebar, shows the languages the country is live in. The system works it
out on every save: a country is live in a language when it is ready and has a name in that
language. Clearing the name in one language takes the country off the site in that language.

**Root Area,** in the sidebar, is the area for the whole country. It is set for you when that area
is added, by import or by hand.

## 5. Areas and offices

**Areas** are a country's places, nested: the country, then its counties, then their
constituencies, and so on. **Offices** are its titles, such as Governor or Member of Parliament.
Importing them from a spreadsheet is quickest (section 6). Only super-admins manage them.

### An area by hand

Places > Areas > Create New.

| Field   | What to enter                                                          |
| ------- | ---------------------------------------------------------------------- |
| Name    | Such as "Nairobi County". One value per language                       |
| Type    | country, region, county, constituency, ward, city or other             |
| Parent  | The area it sits in. The whole-country area has none                   |
| Page    | Automatic, always or never. See below                                  |
| Country | In the sidebar. The parent must be in the same country                 |
| Slug    | In the sidebar. Leave it empty: it is made from the name when you save |

Each country has one area of type **country**, which stands for the whole country. Add it first.
It never has a page of its own.

**Page.** "Automatic" gives an area a page when two or more seats answer for it. A seat is an area
plus an office: if Governor, Senator and Woman Representative all have the area type "county",
every county has three seats and gets a page. A constituency with only an MP gets none: its address
lists its seat instead. "Always" and "never" override this.

**Slugs** are the lower-case names in addresses, such as `nairobi-county` in
`/en/ke/nairobi-county`. Each is unique within its country. One cannot be a word the site uses for
its own pages (`officials`, `e`, `p`, `a`, `search`, `feed.xml`, `opengraph-image`) or a national
office's slug. If you change a slug, the old one is kept so old links can redirect.

Payload refuses a parent that would make a loop, such as putting a county inside one of its own
constituencies.

### An office by hand

Places > Offices > Create New.

| Field            | What to enter                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Name, Short name | Such as "Member of Parliament" and "MP". One value per language                                                                                |
| Area type        | The type of area it answers for: county for a governor, country for the president. Empty for an office with no area, such as a party-list seat |
| Holders per seat | Usually 1. More for seats with several members                                                                                                 |
| Order            | Lower comes first. Put the highest office first                                                                                                |
| Slug             | In the sidebar. Made from the name when you save                                                                                               |

An office with area type **country**, or none, is national: its address is `/{lang}/{cc}/{slug}`,
such as `/en/ke/president`.

## 6. Importing from a spreadsheet

Imports > Imports > Create New.

1. **Upload** a CSV or Excel file, up to 5 MB and 10,000 rows. Excel files are read from their first
   sheet.
2. Choose the **Country** and what **The file holds**: areas or offices.
3. **Save.** The file is read, and the **Mapping** fills in: which column fills each field. It comes
   from a saved mapping whose columns all appear in the file, or from column headings named like the
   fields, such as "Name", "Type", "Parent", "Area type" or "Name (fr)".
4. **Check the mapping.** Add a row for any column it missed, or fix one it got wrong. A field such
   as `name:fr` takes the French name.
5. Set **Next step** to **Preview** and save. Nothing is saved yet. The preview counts the rows that
   would be created, updated or skipped, and **Errors** lists problems by spreadsheet row, with the
   headings as row 1.
6. Fix the file or the mapping, and preview again, until it is right.
7. Set **Next step** to **Import** and save. The rows are saved in the background. **Status** shows
   "done" and **Result** shows the counts when it finishes. Reload the page if it still says
   "queued".

To keep a mapping for the next file, type a name in **Save mapping as** before you import. It
appears under Imports > Saved mappings.

**Importing the same file again** updates or skips rows rather than adding duplicates: each row is
matched by country and slug.

**Areas must come after their parents.** List the whole-country area first, then counties, then
constituencies. A row whose parent is missing, or further down, is reported as an error.

### Spreadsheet layout

Areas, one row per area:

| Name           | Type         | Parent         | Code |
| -------------- | ------------ | -------------- | ---- |
| Kenya          | country      |                | KE   |
| Nairobi County | county       | Kenya          | 047  |
| Kibra          | constituency | Nairobi County |      |

Offices, one row per office:

| Name      | Short name | Area type | Holders per seat | Order | Name (fr)  |
| --------- | ---------- | --------- | ---------------- | ----- | ---------- |
| President | President  | country   | 1                | 1     | Président  |
| Governor  | Governor   | county    | 1                | 2     | Gouverneur |

`tests/fixtures/kenya-areas.csv` and `tests/fixtures/kenya-offices.csv` in the repository are full
examples.

## 7. Area outlines

An outline is the shape of an area on a map, kept for the maps in version 2. It is a **GeoJSON**
file, usually ending in `.geojson`, not an image. Boundary data comes from sources such as a
country's electoral commission or OpenStreetMap, and many need crediting.

1. Places > Boundaries > Create New.
2. Upload the `.geojson` file. It must be a Polygon, MultiPolygon, Feature, FeatureCollection or
   GeometryCollection, up to 10 MB.
3. Fill in **Source**, such as "IEBC", and **Licence**, such as "ODbL 1.0". Both are required.
4. Save, then open the area. In the collapsed **Map** section, choose the file under **Outline**.

The Map section also holds the area's centre, as latitude and longitude, and its bounds. All of it
is optional.

## 8. Site settings

Public site > Site settings. Editors and super-admins can change these.

| Tab                   | Holds                                                                               |
| --------------------- | ----------------------------------------------------------------------------------- |
| Explainer             | The one-line description, and the longer explanation shown collapsed on every page  |
| Navigation and footer | Links in the header and the footer, and the footer's "about" text                   |
| Interface text        | The words on buttons, menus and notices. Leave a box empty to use the default shown |

These are per language: switch language at the top right to edit another. Interface text in a
language with no translation shows in English.

## 9. When changes appear on the site

A saved change appears on the site at once: the pages it affects are refreshed when the save
completes. If a page still shows old content, reload it once.

A country appears only when it is **ready** and published in the visitor's language. Its areas and
offices appear wherever the country does, in each language they have a name in.
