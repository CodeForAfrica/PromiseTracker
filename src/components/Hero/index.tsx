import { resolveMedia } from "@/lib/data/media";
import { getGlobalPayload } from "@/lib/payload";
import type {
  HeroBlock,
  PoliticalEntity,
  Promise as PromiseDocument,
  PromiseStatus,
} from "@/payload-types";
import { format } from "date-fns";

import { HeroClient } from "./Hero.Client";

export type HeroStatusSummary = {
  id: string;
  label: string;
  description: string;
  color?: string | null;
  textColor?: string | null;
  count: number;
  percentage: number;
};

export type HeroChartGroup = {
  title: string;
  statuses: HeroStatusSummary[];
};

export type HeroResolvedData = {
  headline: string;
  copy: {
    promiseLabel: string;
    trailText: string;
    updatedAtLabel: string;
    profileTitle: string;
    statusListTitle: string;
  };
  entity: {
    name: string;
    position: string;
    updatedAtISO: string;
    updatedAtDisplay: string;
    image: {
      url: string;
      alt: string;
    } | null;
  };
  metrics: {
    total: number;
    statuses: HeroStatusSummary[];
    groups: HeroChartGroup[];
  };
};

type HeroProps = HeroBlock & {
  entitySlug?: string;
};

type StatusById = Map<string, PromiseStatus>;

type StatusSummaryMap = Map<string, HeroStatusSummary>;

type PromiseExtraction = NonNullable<PromiseDocument["extractions"]>[number];

const FALLBACK_GROUP_DEFINITIONS = [
  {
    title: "Promise kept",
    labels: ["completed", "in progress"],
  },
  {
    title: "Uncertain",
    labels: ["inconclusive", "unstarted"],
  },
  {
    title: "Promise not kept",
    labels: ["behind schedule", "stalled"],
  },
];

const resolveExtractionStatus = (
  extraction: PromiseExtraction,
  statusById: StatusById
): PromiseStatus | null => {
  const statusRef = extraction.Status;

  if (!statusRef) {
    return null;
  }

  if (typeof statusRef === "string") {
    return statusById.get(statusRef) ?? null;
  }

  return statusRef;
};

const formatUpdatedAt = (date: string): string => {
  try {
    return format(new Date(date), "MMMM d, yyyy");
  } catch (_error) {
    return date;
  }
};

const buildStatusSummaries = (statuses: PromiseStatus[]): StatusSummaryMap => {
  return new Map(
    statuses.map((status) => [
      status.id,
      {
        id: status.id,
        label: status.label,
        description: status.description,
        color: status.colors?.color ?? null,
        textColor: status.colors?.textColor ?? null,
        count: 0,
        percentage: 0,
      },
    ])
  );
};

const buildChartGroups = (
  blockGroups: HeroBlock["chartGroups"] | undefined | null,
  summaries: StatusSummaryMap
): HeroChartGroup[] => {
  const summaryByLabel = new Map(
    Array.from(summaries.values()).map((summary) => [
      summary.label.toLowerCase(),
      summary,
    ])
  );

  if (!blockGroups?.length) {
    return FALLBACK_GROUP_DEFINITIONS.map((definition) => {
      const statuses = definition.labels
        .map((label) => summaryByLabel.get(label))
        .filter((summary): summary is HeroStatusSummary => Boolean(summary));

      if (!statuses.length) {
        return null;
      }

      return {
        title: definition.title,
        statuses: statuses.map((status) => ({ ...status })),
      } satisfies HeroChartGroup;
    }).filter((group): group is HeroChartGroup => group !== null);
  }

  return blockGroups
    .slice(0, 3)
    .map((group) => {
      const statuses = (group.statuses ?? [])
        .map((statusRef) => {
          const statusId =
            typeof statusRef === "string" ? statusRef : statusRef.id;
          return summaries.get(statusId);
        })
        .filter((summary): summary is HeroStatusSummary => Boolean(summary));

      if (statuses.length === 0) {
        return null;
      }

      const title = group.title?.trim() || statuses[0].label;

      return {
        title,
        statuses: statuses.map((status) => ({ ...status })),
      } satisfies HeroChartGroup;
    })
    .filter((group): group is HeroChartGroup => group !== null);
};

export const Hero = async ({ entitySlug, ...block }: HeroProps) => {
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
    depth: 2,
  });

  const entity = entityQuery.docs[0] as PoliticalEntity | undefined;

  if (!entity) {
    return null;
  }

  const { docs: statusDocs } = await payload.find({
    collection: "promise-status",
    limit: -1,
    depth: 0,
  });

  const statusById: StatusById = new Map(
    statusDocs.map((status) => [status.id, status])
  );
  const statusSummaries = buildStatusSummaries(statusDocs);

  const { docs: documentDocs } = await payload.find({
    collection: "documents",
    where: {
      politicalEntity: {
        equals: entity.id,
      },
    },
    limit: -1,
  });

  const documentIds = documentDocs.map((doc) => doc.id);

  const { docs: promiseDocs } = documentIds.length
    ? await payload.find({
        collection: "promises",
        where: {
          document: {
            in: documentIds,
          },
        },
        depth: 2,
        limit: -1,
      })
    : { docs: [] };

  let totalExtractions = 0;

  for (const promiseDoc of promiseDocs) {
    const extractions = promiseDoc.extractions ?? [];

    for (const extraction of extractions) {
      const status = resolveExtractionStatus(extraction, statusById);

      if (!status) {
        continue;
      }

      const summary = statusSummaries.get(status.id);
      if (!summary) {
        continue;
      }

      summary.count += 1;
      totalExtractions += 1;
    }
  }

  statusSummaries.forEach((summary) => {
    summary.percentage =
      totalExtractions > 0 ? (summary.count / totalExtractions) * 100 : 0;
  });

  const groups = buildChartGroups(block.chartGroups, statusSummaries);

  const summaries: HeroStatusSummary[] = Array.from(statusSummaries.values()).map(
    (summary) => ({ ...summary })
  );

  const entityImage = await resolveMedia(payload, entity.image);

  const taglineText = block.tagline?.trim();
  const headline =
    [taglineText, entity.name].filter(Boolean).join(" ") || entity.name;

  const profileTitleBase =
    block.profileTitleOverride?.trim() || entity.position;
  const profileTitle = profileTitleBase
    ? `${profileTitleBase} ${entity.name}`.trim()
    : entity.name;

  const copyPromiseLabel = block.promiseLabel?.trim() || "promises tracked";
  const copyTrailText = block.trailText?.trim() || "tracked on PromiseTracker.";
  const statusListTitle = block.statusListTitle?.trim() || "Promise status definitions";
  const updatedAtLabel = block.updatedAtLabel?.trim() || "Last updated";

  const resolvedData: HeroResolvedData = {
    headline,
    copy: {
      promiseLabel: copyPromiseLabel,
      trailText: copyTrailText,
      updatedAtLabel,
      profileTitle,
      statusListTitle,
    },
    entity: {
      name: entity.name,
      position: entity.position,
      updatedAtISO: entity.updatedAt,
      updatedAtDisplay: formatUpdatedAt(entity.updatedAt),
      image: entityImage,
    },
    metrics: {
      total: totalExtractions,
      statuses: summaries,
      groups,
    },
  };

  return <HeroClient data={resolvedData} />;
};
