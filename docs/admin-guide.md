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
7. Claims and topics
8. Importing from a spreadsheet
9. Area outlines
10. Documents
11. Site settings
12. Publishing: what is public, and when

The admin's menu groups record types by what they are for:

| Group          | Holds                                             |
| -------------- | ------------------------------------------------- |
| People         | Actors, Terms                                     |
| Claims         | Claims, Topics, Rating scales, Claim types        |
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

**Published in,** in the sidebar, shows the languages the country is live in. Section 12 explains
how it is worked out, and what holding a country does to everything in it.

**Root Area,** in the sidebar, is the area for the whole country. It is set for you when that area
is added, by import or by hand.

## 5. Areas and offices

**Areas** are a country's places, nested: the country, then its counties, then their
constituencies, and so on. **Offices** are its titles, such as Governor or Member of Parliament.
Importing them from a spreadsheet is quickest (section 8). Only super-admins manage them.

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
super-admins add them. Importing them from a spreadsheet is quickest (section 8).

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

## 7. Claims and topics

**Claims** are what an actor said they would do. Each is rated on its claim type's scale, which
starts as the Delivery scale. **Topics**, such as Health, label claims, and every country shares
them.

### A topic

Claims > Topics > Create New. Give it a name in each language, and optionally a description and a
colour. **Parent** puts it under a broader topic, such as Universal health coverage under Health.
Topics go one level deep: a topic with a parent cannot have topics under it. The slug, in the
sidebar, is made from the name, and the topic's page is `/{lang}/topics/{slug}`, such as
`/en/topics/health`.

### A claim by hand

Claims > Claims > Create New.

| Field                            | What to enter                                                            |
| -------------------------------- | ------------------------------------------------------------------------ |
| Title                            | The headline, such as "Build 200,000 homes a year". One per language     |
| Statement                        | The exact words, in the language they were said. Never translated        |
| Summary                          | Context for readers. One per language                                    |
| Actor, Co-actors                 | Who made it, and anyone alongside, such as their party                   |
| Term, Area                       | The term it belongs to, and the area when narrower than the actor's seat |
| Topic, Type                      | Leave the type empty for a Promise                                       |
| Said at, Said on                 | Where and when, such as a rally in Kisumu, 2022-06                       |
| Deadline, Deadline in words      | When it is due, and the same in words, such as "End of term"             |
| Source link, Where in the source | A link readers can follow, and the page or section                       |

**Dates** can be a year, a month or a day: `2027`, `2027-08` or `2027-08-09`. Give only what is
known.

**The rating** starts on the starting rating of the claim type's scale, Unstarted for a Promise.
It shows in the sidebar, and changes through claim updates once they arrive.

The slug, in the sidebar, is made from the title in the language of the first save, so add a new
claim in the language whose title should name its address. The claim's page is `/{lang}/{cc}/p/{slug}`, such
as `/en/ke/p/build-200000-homes-a-year`. A renamed slug's old address leads to the new one. If you
clear the slug, it is made again from the title in the language you are editing, so clear it while
editing in the language whose title should name the address.

A claim starts on **hold**. Set it to **ready** to publish it. It is public only once it passes its
checks: it has a **topic**, a **source** (a link to where it was said, or a source document), and a
**deadline** if its rating needs one. Until then **Why it is not public**, in the sidebar, says what
is missing. Once built-in verification arrives, a claim must also be verified.

### The key claim

On an actor, the collapsed **Key claim** section picks the claim that matters most, with a note on
why. It shows first on the actor's page.

### What appears on the site

- **The claim page** shows the claim, who made it, where, when and by when, and its rating.
- **The actor page** shows the key claim, the record so far, and their claims, which readers can
  filter by rating and topic.
- **The topic page** shows the topic's figures in each country, and its claims.

**Counts or percentages.** Below 20 claims, figures show as counts, such as "1 of 3", not
percentages. Change the number in Public site > Site settings > Figures.

## 8. Importing from a spreadsheet

Imports > Imports > Create New.

1. **Upload** a CSV or Excel file, up to 5 MB and 10,000 rows. Excel files are read from their first
   sheet.
2. Choose the **Country** and what **The file holds**: areas, offices, actors, terms or claims.
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

Claims, one row per claim. Import the actors and add the topics first. Name the actor, topic and
area by name or slug. Dates can be a year, a month or a day:

| Title                     | Actor          | Topic   | Said on | Deadline | Deadline in words |
| ------------------------- | -------------- | ------- | ------- | -------- | ----------------- |
| Build 5000 homes in Kibra | Achieng Wekesa | Housing | 2022-07 | 2027     | End of term       |

A claim row matches an existing claim by its slug, made from the title unless a Slug column gives
one. Imported claims start on **hold**.

`tests/fixtures/kenya-areas.csv`, `kenya-offices.csv`, `kenya-actors.csv`, `kenya-terms.csv` and
`kenya-claims.csv` in the repository are full examples. The people in them are fictional.

## 9. Area outlines

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

## 10. Documents

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

## 11. Site settings

Public site > Site settings. Editors and super-admins can change these.

| Tab                   | Holds                                                                               |
| --------------------- | ----------------------------------------------------------------------------------- |
| Explainer             | The one-line description, and the longer explanation shown collapsed on every page  |
| Navigation and footer | Links in the header and the footer, and the footer's "about" text                   |
| Interface text        | The words on buttons, menus and notices. Leave a box empty to use the default shown |

These are per language: switch language at the top right to edit another. Interface text in a
language with no translation shows in English.

## 12. Publishing: what is public, and when

Every country, actor and claim has two things in the sidebar.

- **Record Status** is what you want: **ready**, **hold** or **archived**. New records start on
  hold.
- **Published in** is what the system works out: the languages the record is live in.

A record is live in a language when all of these hold:

1. It is **ready**.
2. It is **published in that language** (see "Saving and publishing" below).
3. Its required text has a value in that language, such as a claim's title.
4. Everything above it is live in that language. A country is above its areas, actors and claims,
   and an actor is above their claims.
5. It passes its own checks: a claim needs a topic, a source, and a deadline if its rating needs
   one. A person needs a term that has started.

### Saving and publishing

Countries, actors and claims are saved one language at a time. The language menu at the top right
chooses which.

- **Save Draft** keeps your changes without putting them on the site.
- **Publish in English**, or the language you are in, makes this language's text live.
- The arrow beside it has **Publish in all languages**, for when every translation is ready.

A record published in English and saved only as a draft in French is live in English only. A reader
on the French page sees a short "not available in this language" notice with a link to English.

### Holding and releasing

Setting a record to **hold** takes it off the site, and with it everything under it. Hold a country
and all its actors and claims leave the site within seconds. Hold an actor and their claims leave
with them.

Setting it back to **ready** brings back only what was not held on its own. A claim you held
yourself stays held when its country is released.

### Archiving, the trash and emails

**Archived** is for records that should stay in the system but not on the site, such as a
withdrawn claim. Delete only what was added by mistake.

**Delete** moves a record to the **trash**, where it is off the site and can be restored.
Each record type's list has a trash view. Only a super-admin can delete a record for good, from the
trash.

Editors and super-admins get an email when a record is archived or restored, and when a country is
put on hold.

### When something is not public

Look at **Why it is not public** in the sidebar of a claim, then at **Published in** on its actor
and country. If a whole country seems missing, check its record status first.

### When changes appear on the site

A saved change appears on the site at once: the pages it affects are refreshed when the save
completes. If a page still shows old content, reload it once. Pages that name office holders also
refresh every hour, so a term that starts or ends on its date shows within the hour.

A developer can work out every record's published status again with `pnpm publishing:recompute`,
after changing the languages the site runs in.
