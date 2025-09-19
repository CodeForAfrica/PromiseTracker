import { resolveMedia } from "@/lib/data/media";
import { getGlobalPayload } from "@/lib/payload";
import type {
  KeyPromises as KeyPromisesBlock,
  PoliticalEntity,
  Promise as PromiseDocument,
  PromiseStatus,
} from "@/payload-types";
import { KeyPromisesClient, type KeyPromiseItem } from "./KeyPromises.Client";

const DEFAULT_ITEMS = 5;

const parseYear = (value?: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }
  const year = new Date(value).getFullYear();
  return Number.isNaN(year) ? undefined : year;
};

const buildStatus = (status?: PromiseStatus | null) => {
  if (!status) {
    return null;
  }

  const color = status.colors?.color ?? "#909090";
  const textColor = status.colors?.textColor ?? "#202020";

  return {
    color,
    label: status.label,
    textColor,
  };
};

export type KeyPromisesProps = KeyPromisesBlock & {
  entitySlug?: string;
};

export const KeyPromises = async ({
  entitySlug,
  title,
  actionLabel,
  itemsToShow,
}: KeyPromisesProps) => {
  if (!entitySlug) {
    return null;
  }

  const payload = await getGlobalPayload();

  const entityQuery = await payload.find({
    collection: "political-entities",
    where: {
      slug: {
        equals: entitySlug,
      },
    },
    limit: 1,
    depth: 0,
  });

  const entity = entityQuery.docs[0] as PoliticalEntity | undefined;

  if (!entity) {
    return null;
  }

  const statusQuery = await payload.find({
    collection: "promise-status",
    limit: -1,
    depth: 0,
  });

  const statusById = new Map<string, PromiseStatus>(
    (statusQuery.docs as PromiseStatus[]).map((status) => [status.id, status])
  );
  const statusByLabel = new Map<string, PromiseStatus>();
  (statusQuery.docs as PromiseStatus[]).forEach((status) => {
    const labelKey = status.label?.trim().toLowerCase();
    if (labelKey) {
      statusByLabel.set(labelKey, status);
    }

    const meedanKey = status.meedanId?.trim().toLowerCase();
    if (meedanKey && !statusByLabel.has(meedanKey)) {
      statusByLabel.set(meedanKey, status);
    }
  });

  const resolvedLimit = Math.max(1, itemsToShow ?? DEFAULT_ITEMS);

  const promisesQuery = await payload.find({
    collection: "promises",
    where: {
      politicalEntity: {
        equals: entity.id,
      },
    },
    limit: resolvedLimit,
    depth: 1,
    sort: "-lastPublished,-updatedAt",
  });

  const promiseDocs = promisesQuery.docs as PromiseDocument[];

  const items: KeyPromiseItem[] = [];

  for (const promise of promiseDocs) {
    const statusRelation = promise.status;
    let statusDoc: PromiseStatus | null = null;

    if (statusRelation) {
      if (typeof statusRelation === "string") {
        statusDoc = statusById.get(statusRelation) ?? null;
      } else {
        statusDoc = statusRelation;
      }
    }

    if (!statusDoc) {
      const lookupKey = promise.statusLabel?.trim().toLowerCase();
      if (lookupKey) {
        statusDoc = statusByLabel.get(lookupKey) ?? null;
      }
    }

    const statusDetails =
      buildStatus(statusDoc) ??
      (promise.statusLabel
        ? {
            color: promise.themeColor?.trim() || "#005dfd",
            label: promise.statusLabel,
            textColor: "#202020",
          }
        : null);

    if (!statusDetails) {
      continue;
    }

    const image = await resolveMedia(promise.image ?? null);
    const titleText =
      promise.headline?.trim() || promise.title?.trim() || "Promise";
    const description =
      promise.description?.trim() ||
      promise.text?.trim() ||
      promise.introduction?.trim() ||
      undefined;
    const href = promise.publishedArticleUrl?.trim() || undefined;
    const statusDate = promise.lastPublished ?? promise.updatedAt;

    const statusHistory = [
      {
        color: statusDetails.color,
        label: statusDetails.label,
        textColor: statusDetails.textColor,
        date: statusDate,
      },
    ];

    items.push({
      id: promise.id,
      title: titleText,
      description,
      href,
      imageUrl: image?.url ?? undefined,
      status: { ...statusDetails, date: statusDate },
      statusHistory,
      events: [],
    });

    if (items.length >= resolvedLimit) {
      break;
    }
  }

  if (!items.length) {
    return null;
  }

  const entityStartYear = parseYear(entity.periodFrom);
  const entityEndYear = parseYear(entity.periodTo);

  let timelineInterval: [number, number] | undefined;

  if (entityStartYear && entityEndYear && entityEndYear > entityStartYear) {
    timelineInterval = [entityStartYear, entityEndYear];
  }

  if (!timelineInterval) {
    const years: number[] = [];
    items.forEach((item) => {
      item.statusHistory.forEach((history) => {
        const year = parseYear(history.date);
        if (year !== undefined) {
          years.push(year);
        }
      });
    });

    if (years.length) {
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      timelineInterval =
        minYear === maxYear ? [minYear, minYear + 1] : [minYear, maxYear];
    }
  }

  if (!timelineInterval) {
    const currentYear = new Date().getFullYear();
    timelineInterval = [currentYear, currentYear + 1];
  }

  return (
    <KeyPromisesClient
      title={title}
      actionLabel={actionLabel ?? "Learn more"}
      items={items}
      timelineInterval={timelineInterval}
    />
  );
};

export default KeyPromises;
