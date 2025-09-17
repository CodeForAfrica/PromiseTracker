import { resolveMedia } from "@/lib/data/media";
import { getGlobalPayload } from "@/lib/payload";
import type {
  Document,
  KeyPromises as KeyPromisesBlock,
  PoliticalEntity,
  Promise as PromiseDocument,
  PromiseStatus,
} from "@/payload-types";
import { KeyPromisesClient, type KeyPromiseItem } from "./KeyPromises.Client";

const MAX_ITEMS = 5;

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

const getDocumentId = (document: PromiseDocument["document"]): string | null => {
  if (!document) {
    return null;
  }

  return typeof document === "string" ? document : document.id;
};

export type KeyPromisesProps = KeyPromisesBlock & {
  entitySlug?: string;
};

export const KeyPromises = async ({ entitySlug, title, actionLabel }: KeyPromisesProps) => {
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

  const documentsQuery = await payload.find({
    collection: "documents",
    where: {
      and: [
        {
          politicalEntity: {
            equals: entity.id,
          },
        },
        {
          type: {
            equals: "promise",
          },
        },
      ],
    },
    limit: -1,
    depth: 1,
  });

  if (!documentsQuery.docs.length) {
    return null;
  }

  const documentMap = new Map<string, Document>();
  for (const document of documentsQuery.docs as Document[]) {
    documentMap.set(document.id, document);
  }

  const documentIds = Array.from(documentMap.keys());

  const statusQuery = await payload.find({
    collection: "promise-status",
    limit: -1,
    depth: 0,
  });

  const statusById = new Map<string, PromiseStatus>(
    (statusQuery.docs as PromiseStatus[]).map((status) => [status.id, status]),
  );

  const promisesQuery = await payload.find({
    collection: "promises",
    where: {
      document: {
        in: documentIds,
      },
    },
    limit: -1,
    depth: 2,
  });

  const promiseDocs = (promisesQuery.docs as PromiseDocument[]).sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const items: KeyPromiseItem[] = [];

  for (const promise of promiseDocs) {
    if (items.length >= MAX_ITEMS) {
      break;
    }

    const docId = getDocumentId(promise.document);
    const document = docId ? documentMap.get(docId) ?? null : null;
    const imageSource = document?.files?.[0] ?? null;
    const image = await resolveMedia(payload, imageSource);

    const extractions = promise.extractions ?? [];

    for (const [index, extraction] of extractions.entries()) {
      if (items.length >= MAX_ITEMS) {
        break;
      }

      const statusRef = extraction.Status;
      const statusData =
        typeof statusRef === "string"
          ? statusById.get(statusRef)
          : statusRef ?? null;

      const status = buildStatus(statusData);

      if (!status) {
        continue;
      }

      const summaryText = extraction.summary?.trim();
      const titleText = summaryText || promise.title?.trim() || document?.title || "Promise";
      const description = extraction.source?.trim();
      const href = extraction.checkMediaURL || document?.url || undefined;

      const statusHistory = [
        {
          color: status.color,
          label: status.label,
          textColor: status.textColor,
          date: promise.updatedAt,
        },
      ];

      items.push({
        id: `${promise.id}-${extraction.id ?? extraction.uniqueId ?? index}`,
        title: titleText,
        description,
        href,
        imageUrl: image?.url ?? undefined,
        status: { ...status, date: promise.updatedAt },
        statusHistory,
        events: [],
      });
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
      timelineInterval = minYear === maxYear ? [minYear, minYear + 1] : [minYear, maxYear];
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
