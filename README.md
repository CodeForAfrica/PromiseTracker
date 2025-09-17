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
5. When testing multitenant app, use a domain that resolves to localhost, similar to `localtest.me`, for example `ken.localtest.me:3000`

## Docker Image

- Build the production image (bundles Apache Tika 3.2.3, no database services):
  `docker build -t promisetracker:latest --build-arg DATABASE_URI="<build-time-database-uri>" .`
- Run the container against an external database:
  `docker run -p 3000:3000 -e DATABASE_URI="<your-database-uri>" -e PAYLOAD_SECRET="<secret>" promisetracker:latest`
- The bundled Apache Tika server listens on `http://127.0.0.1:9998/`. Override `AX_APACHE_TIKA_URL`, `TIKA_PORT`, or `TIKA_ENABLED=0` if you prefer an external Tika service.
- The Docker build uses build-time placeholders: `DATABASE_URI` defaults to `mongodb://127.0.0.1:27017/payload-build` and `PAYLOAD_SECRET` defaults to `docker-build-secret`. Override them with `--build-arg DATABASE_URI=... --build-arg PAYLOAD_SECRET=...` when running `docker build`. At runtime, always provide your production values via environment variables.
