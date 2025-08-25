**PromiseTracker**, is a tool to help journalists and civil society watchdogs more easily track campaign promises and other political / government pledges, using official evidence / data, as well as crowdsourced information, with a transparent and defensible methodology, to help inject accountability and honesty into the often cavalier way that promises are made to citizens to win their support for elections, policies, contracts ... but are then seldom honoured.

### Requirements

1. CheckDesk API Key and Team ID
2. Airtable API Key and Base ID
3. Google Gemini API Key.
4. Docker

## Running the App.

1. Install dependencies
   `pnpm i`
2. Start Apache Tika
   `docker compose up -d`
3. Run dev server
   `pnpm dev`
4. Update settings in admin
   [/admin/globals/settings]
