import { camelCase } from "lodash";
import papa from "papaparse";

import cacheFn from "@/promisetracker/lib/cache";
import promisesQLFn from "@/promisetracker/lib/jsonql/promises";
import theme from "@/promisetracker/theme";
import { equalsIgnoreCase, formatDate, slugify } from "@/promisetracker/utils";

function gsheets(server) {
  const SPREADSHEETS_URL = "https://docs.google.com/spreadsheets/";
  const spreadsheetId = server.env("GSHEETS_SPREADSHEET_ID");
  const entitiesSheetId = server.env("GSHEETS_ENTITIES_SHEET_ID");
  const sitesSheetId = server.env("GSHEETS_SITES_SHEET_ID");
  const statusesSheetId = server.env("GSHEETS_STATUSES_SHEET_ID");
  const categoriesSheetId = server.env("GSHEETS_CATEGORIES_SHEET_ID");
  const promisesSheetId = server.env("GSHEETS_PROMISES_SHEET_ID");
  const promisesCategoriesSheetId = server.env(
    "GSHEETS_PROMISES_CATEGORIES_SHEET_ID"
  );
  const promisesEventsSheetId = server.env("GSHEETS_PROMISES_EVENTS_SHEET_ID");

  const papaOptions = {
    header: true,
    transformHeader: (header) => camelCase(header.trim()),
    transform: (value) => value?.trim(),
  };

  const papaPromise = (readableStream, options = papaOptions) => {
    const parseStream = papa.parse(papa.NODE_STREAM_INPUT, options);
    readableStream.pipe(parseStream);

    return new Promise((resolve, reject) => {
      const data = [];
      parseStream.on("data", (chunk) => {
        data.push(chunk);
      });
      parseStream.on("end", () => {
        resolve(data);
      });
      parseStream.on("error", (error) => {
        reject(error);
      });
    });
  };

  async function fetchSheet(sheetId, options) {
    const response = await fetch(
      `${SPREADSHEETS_URL}d/${spreadsheetId}/export?format=csv&gid=${sheetId}`
    );
    return papaPromise(response.body, options);
  }

  async function fetchSitesSheet() {
    const options = {
      ...papaOptions,
      dynamicTyping: (header) =>
        ["articles", "resources", "factchecks", "actnow"].includes(
          header.toLowerCase()
        ),
    };
    return fetchSheet(sitesSheetId, options);
  }

  async function fetchSite() {
    const sitesSheet = await fetchSitesSheet();
    const entitiesSheet = await fetchSheet(entitiesSheetId);
    const siteRow = server.slug
      ? sitesSheet.find((row) => equalsIgnoreCase(server.slug, row.slug))
      : sitesSheet[0];
    const entity = entitiesSheet.find((row) =>
      equalsIgnoreCase(row.name, siteRow.entity)
    );
    return { ...siteRow, entity };
  }

  function formatSiteAsProjectMeta(site) {
    const { entity } = site;
    const description = `Campaign Promises made by ${entity.name}`;
    const fullName = entity.fullName || null;
    const name = entity.preferredName || entity.name || null;
    const photo = entity.image || null;
    const position = entity.title || null;
    const promiseLabel = "promises";
    const tagline = `<span class="highlight">Tracking</span> ${name}`;
    const trailText = "at a glance";
    const updatedAt = formatDate(site.lastUpdated || Date.now);
    const updatedAtLabel = "Updated";
    return {
      description,
      fullName,
      name,
      photo,
      position,
      promiseLabel,
      tagline,
      trailText,
      updatedAt,
      updatedAtLabel,
    };
  }

  async function fetchCategories() {
    const categoriesSheet = await fetchSheet(categoriesSheetId);
    return categoriesSheet.filter((row) => row.name);
  }

  async function fetchStatuses() {
    const statusesSheet = await fetchSheet(statusesSheetId);
    const { statusPalette } = theme;
    const getPalette = (ordinal) =>
      statusPalette[`status${ordinal}`] || statusPalette.status0;
    return statusesSheet.map((row) => ({
      ...row,
      ...getPalette(row.ordinal),
      slu: slugify(row.name),
    }));
  }

  function reduceByName(acc, current) {
    // FIXME(kilemensi): Some components expect title instead of name
    const title = current.name;
    acc[camelCase(current.name)] = { ...current, title };
    return acc;
  }

  function extractIdFromEntityPromise(promise) {
    // idET = (promise) id, (entity) Name and (promise) Title
    const idNT = promise.split("/");
    return idNT.length > 1 ? idNT[0]?.trim() : undefined;
  }

  async function fetchPromisesCategories() {
    const categories = (await fetchCategories()).reduce(reduceByName, {});
    const pcSheet = await fetchSheet(promisesCategoriesSheetId);

    return pcSheet
      .filter((row) => row.promise && row.category)
      .map(({ promise, category }) => {
        const id = extractIdFromEntityPromise(promise);
        return { ...categories[camelCase(category)], promise: { id } };
      })
      .filter((row) => row.promise.id);
  }

  async function fetchPromisesEvents() {
    const peSheet = await fetchSheet(promisesEventsSheetId);

    return peSheet
      .filter((row) => row.promise && row.name && row.date)
      .map(({ promise, ...event }) => {
        const id = extractIdFromEntityPromise(promise);
        return { ...event, promise: { id } };
      })
      .filter((row) => row.promise.id);
  }

  async function fetchPromises(cache) {
    const { data: site } = await cache.site;
    const statuses = (await fetchStatuses()).reduce(reduceByName, {});
    const promisesOptions = {
      ...papaOptions,
      dynamicTyping: (header) => ["iskey"].includes(header.toLowerCase()),
    };
    const promisesSheet = await fetchSheet(promisesSheetId, promisesOptions);
    const promisesCategories = await fetchPromisesCategories();
    const promisesEvents = await fetchPromisesEvents();

    return (
      promisesSheet
        .filter((row) => equalsIgnoreCase(row.entity, site.entity.name))
        // 1. promise entity is only used to filter promises belonging to a
        // given site. Shouldn't exist in final promise data.
        // 2. statusVerificationDate should be part of status
        .map(({ entity, statusVerificationDate, ...other }) => ({
          ...other,
          categories: promisesCategories.flatMap(({ promise, ...category }) => {
            if (equalsIgnoreCase(promise.id, other.id)) {
              return [category];
            }
            return [];
          }),
          events: promisesEvents.flatMap(({ promise, ...event }) => {
            if (equalsIgnoreCase(promise.id, other.id)) {
              return [event];
            }
            return [];
          }),
          slug: slugify(other.title),
          status: {
            ...statuses?.[camelCase(other.status)],
            date: statusVerificationDate,
          },
          // TODO(kilemensi): We should change UI components to just use
          //                  status rather than duplicating it here.
          statusHistory: [
            {
              ...statuses?.[camelCase(other.status)],
              date: statusVerificationDate,
            },
          ],
        }))
    );
  }

  const fetchFor = {
    site: fetchSite,
    promises: fetchPromises,
  };
  const gcache = cacheFn(server, fetchFor);

  async function promisesQL() {
    const { data: promises } = await gcache.promises;
    return promisesQLFn(promises);
  }

  const api = {
    sites: () => ({
      get current() {
        return (async () => {
          const { data: site } = await gcache.site;
          return site;
        })();
      },
    }),
    // TODO(kilemensi): This should be replaced by current but it requires
    //                  changing components first.
    project: () => ({
      get meta() {
        return (async () => {
          const site = await api.sites().current;
          return formatSiteAsProjectMeta(site);
        })();
      },
    }),
    promises: (options) => {
      return {
        get all() {
          return (async () => {
            const ql = await promisesQL();
            return ql.getPromises(options);
          })();
        },
        get categories() {
          return (async () => {
            const ql = await promisesQL();
            return ql.getCategories();
          })();
        },
        get first() {
          return (async () => {
            const ql = await promisesQL();
            return ql.getPromise(options);
          })();
        },
        get key() {
          return (async () => {
            const ql = await promisesQL();
            return ql.getPromises({ ...options, isKey: true });
          })();
        },
        get statuses() {
          return (async () => {
            const ql = await promisesQL();
            return ql.getStatuses();
          })();
        },
      };
    },
  };

  return api;
}

export default gsheets;
