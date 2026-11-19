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
6. Actors and terms
7. Importing from a spreadsheet
8. Area outlines
9. Documents
10. Site settings
11. When changes appear on the site

The admin's menu groups record types by what they are for:

| Group          | Holds                                             |
| -------------- | ------------------------------------------------- |
| People         | Actors, Terms                                     |
| Places         | Countries, Areas, Offices, Boundaries             |
| Sources        | Documents, Source files                           |
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

**A forgotten password.** "Forgot password?" on the sign-in page sends a reset link once the server
has an email provider (`SMTP_HOST`). In development the email goes to Mailpit, at
http://localhost:8025. Without a provider, ask a super-admin to set a new password: Administration >
Users, open the user, and type a new one.

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
Importing them from a spreadsheet is quickest (section 7). Only super-admins manage them.

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

## 6. Actors and terms

**Actors** are the people, parties and institutions the site tracks. **Terms** are an actor's time
in a seat: an office, and the area for offices that have one. Editors, contributors and
super-admins add them. Importing them from a spreadsheet is quickest (section 7).

### An actor by hand

People > Actors > Create New.

| Field               | What to enter                                                      |
| ------------------- | ------------------------------------------------------------------ |
| Name                | Such as "Achieng Wekesa", or "Umoja Party"                         |
| Kind                | person, party or institution                                       |
| Short name          | Optional, such as a party's initials                               |
| Honorific, Gender   | For a person. Such as "Hon." or "H.E."                             |
| Institution type    | For an institution, such as ministry or agency                     |
| Image, Image credit | A photo from the media library, and who took it                    |
| Biography           | A few lines on who this is. One value per language                 |
| Links               | Their official site and social accounts                            |
| Country, Slug       | In the sidebar. The slug is made from the name when you save       |
| Record Status       | In the sidebar. Starts on **hold**. Set it to **ready** to publish |

A slug is unique in its country, across people, parties and institutions. The actor's address is
`/{lang}/{cc}/e/{slug}`, such as `/en/ke/e/achieng-wekesa`. If you change a slug, the old address
leads to the new one.

**When a person appears on the site.** A person is public once they are ready and their first
term has started. Someone whose only term starts later, a candidate, does not appear.
**On Record Since**, in the sidebar, shows when that is. It is set from their terms. Parties and
institutions appear once they are ready.

**Related**, at the bottom of a saved actor, lists their terms, newest first. For a party it
also lists the terms held for it. **Add new** there starts a term with the actor filled in.
Offices list their holders, areas list the areas in them and their terms, and countries list
their areas, offices and actors, in the same folded section.

An actor named in a term cannot be deleted. Set it to **archived** instead, or change the terms
first.

### A term by hand

People > Terms > Create New.

| Field                          | What to enter                                                                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actor                          | Who held the seat                                                                                                                                                     |
| Office, Area                   | The seat. Leave the area empty for a national office, such as President. Otherwise choose an area of the type the office answers for, such as a county for a governor |
| Party                          | Their party during this term, an actor of kind party                                                                                                                  |
| Elected on, Starts on, Ends on | Leave **Ends on** empty while they are in office                                                                                                                      |
| Closing summary                | What the term delivered. Written when it ends. One value per language                                                                                                 |
| Successor                      | Who took the seat next                                                                                                                                                |

The actor, office, area, party and successor must all be in one country.

**Stage**, in the sidebar, is worked out from the dates: **candidate** before the term starts,
**current** during it, **past** once it has ended. It changes on its own as the dates pass.
Dates are whole days in UTC: a term is current from the start of its first day to the end of its
last, so in Kenya it changes at 03:00. The site shows the change within the hour.

A seat holds as many people at once as its office's **Holders per seat**, usually one. A term
that would overlap another in a full seat is refused: end the old term first. The new term may
start on the day the old one ends. The check runs when a term is saved: two people saving terms for the
same seat at the same moment could both get through, so check the seat afterwards.

**When a term ends,** set **Ends on**, write the **Closing summary**, and choose the
**Successor**. Then add the new holder's term. The seat's address, such as
`/en/ke/nairobi-county/governor`, then leads to the new holder. The former holder keeps their
page, marked as a former office holder, with the closing summary and a link to the successor.

### What appears on the site

- **Seat addresses** lead to whoever holds the seat today. A seat with several holders lists
  them. An area with only one seat, such as a constituency with its MP, leads to that seat's holder.
- **The officials list**, at `/{lang}/{cc}/officials`, lists everyone in office today. Readers
  can filter it by office, area and party.
- **The country page** shows "Who is delivering" and "Officials" when two or more people hold
  office, and leads with the one holder when there is only one. "Past administrations" appears
  once a term has ended.
- **Area pages** name each seat's holders.

## 7. Importing from a spreadsheet

Imports > Imports > Create New.

1. **Upload** a CSV or Excel file, up to 5 MB and 10,000 rows. Excel files are read from their first
   sheet.
2. Choose the **Country** and what **The file holds**: areas, offices, actors or terms.
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
constituencies. A row whose parent is missing, or further down, is reported as an error. So is a
row whose parent's row failed.

**An empty Parent cell keeps the area's current parent.** To move an area, give its new parent. An
area cannot be detached from its parent by import: do that by hand.

**The preview checks what the import checks:** required values, slugs, parents, and the rules on
slugs and the whole-country area. A save can still fail for a reason the preview cannot see, such
as someone else changing the same records in between.

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

Actors, one row per actor. Import parties before the terms that name them:

| Name           | Kind   | Honorific | Gender | Biography            | Biography (fr)           |
| -------------- | ------ | --------- | ------ | -------------------- | ------------------------ |
| Umoja Party    | party  |           |        |                      |                          |
| Achieng Wekesa | person |           | female | Governor since 2022. | Gouverneure depuis 2022. |

Terms, one row per term. Import the areas, offices and actors first. Name each record by its name
or its slug. Dates are written as YYYY-MM-DD:

| Actor          | Office   | Area           | Party       | Starts on  | Ends on    | Successor      |
| -------------- | -------- | -------------- | ----------- | ---------- | ---------- | -------------- |
| Baraka Njoroge | Governor | Nairobi County | Umoja Party | 2017-08-21 | 2022-08-25 | Achieng Wekesa |
| Achieng Wekesa | Governor | Nairobi County | Umoja Party | 2022-08-25 |            |                |

A term row matches an existing term by its actor, office, area and start date, so importing the
same file again updates rather than duplicates. Imported actors start on **hold**: set each to
**ready** to publish it.

`tests/fixtures/kenya-areas.csv`, `kenya-offices.csv`, `kenya-actors.csv` and `kenya-terms.csv` in
the repository are full examples. The people in them are fictional.

## 8. Area outlines

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

## 9. Documents

Documents hold source material, such as a manifesto, a speech, a budget or a report. Only signed-in
staff can see them. Their text is read in the background, ready for finding claims.

Sources > Documents > Create New.

1. Fill in the **Title** and **Country**, and if you know them the **Actors**, **Language**,
   **Publisher** and **Date**. **Type** says whether claims come from it or it is evidence about
   them.
2. Choose how to **Bring it in**:
   - **Uploading a file.** Under **File**, upload a PDF, Word, Excel, PowerPoint, OpenDocument,
     RTF, EPUB, text, Markdown or HTML file, or choose one already uploaded. **Link** is optional,
     and is only shown, never fetched.
   - **Fetching a link.** Paste an `https://` link in **Link**. The server fetches it once and keeps
     the file, so the document stays even if the page changes or goes.
3. **Save.** The **Status** in the sidebar moves through **Waiting**, **Fetching**, **Fetched**,
   **Reading** and **Read**. Reload the page to see it change. Once it says **Read**, the **Text**
   holds the document's text, with every accent and character kept.

The Documents list shows each document's status and message, so you can see which need attention.

**A file is checked before it is kept.** Its first bytes, its type and its extension must agree:
a picture renamed `.pdf` is refused, and so is any SVG file. The message says why.

**A file is stored once.** Uploading a file that is already stored is refused with the name it is
stored under: choose that one instead. Two links to the same file share one stored copy. The files
are under Sources > Source files, where you can add a **Credit** for a file. Replacing a file keeps
the one before it in the file's version history.

**Links are fetched safely.** Only `https://` links are fetched, never addresses inside a private
network, and each redirect is checked the same way. A file must arrive within 5 minutes.

**When a step fails**, **Status** says **Failed** and **Message** says why. A link that is gone, or
a file nothing can read, fails at once. A site that is down or asks us to wait is tried again
later, up to 3 runs, and the message says when. When a document fails for good, whoever added it
gets an email. Fix the file or link and save to start again. Changing only the title or other
details does not start it again.

PDF, Word and the other office formats need the Tika plugin, which comes later. Until then, those
documents fail with a message saying no plugin reads them.

## 10. Site settings

Public site > Site settings. Editors and super-admins can change these.

| Tab                   | Holds                                                                               |
| --------------------- | ----------------------------------------------------------------------------------- |
| Explainer             | The one-line description, and the longer explanation shown collapsed on every page  |
| Navigation and footer | Links in the header and the footer, and the footer's "about" text                   |
| Interface text        | The words on buttons, menus and notices. Leave a box empty to use the default shown |

These are per language: switch language at the top right to edit another. Interface text in a
language with no translation shows in English.

## 11. When changes appear on the site

A saved change appears on the site at once: the pages it affects are refreshed when the save
completes. If a page still shows old content, reload it once.

A country appears only when it is **ready** and published in the visitor's language. Its areas and
offices appear wherever the country does, in each language they have a name in.

Pages that name office holders also refresh every hour, so a term that starts or ends on its date
shows within the hour without anyone saving it.
