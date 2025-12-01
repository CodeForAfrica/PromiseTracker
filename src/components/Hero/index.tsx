import { resolveMedia } from "@/lib/data/media";
import { getGlobalPayload } from "@/lib/payload";
import { resolveEntityLocale } from "@/utils/locales";
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
  headline: {
    tagline?: string;
    name: string;
  };
  copy: {
    promiseLabel: string;
    trailText: string;
    updatedAtLabel: string;
    profileTitle: string;
    statusListTitle: string;
    backToLabel?: string;
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
  navigation: {
    entitySlug?: string;
    backToLabel?: string;
    tenantName?: string;
    tenantHref: string;
  };
};

type HeroProps = HeroBlock & {
  entitySlug?: string;
};

type StatusById = Map<string, PromiseStatus>;

type StatusSummaryMap = Map<string, HeroStatusSummary>;

type PromiseItem = PromiseDocument;

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

const extractSelectedStatusIds = (
  blockGroups: HeroBlock["chartGroups"] | undefined | null
): Set<string> => {
  const statusIds = new Set<string>();

  for (const group of blockGroups ?? []) {
    for (const statusRef of group.statuses ?? []) {
      const statusId =
        typeof statusRef === "string" ? statusRef : statusRef?.id;

      if (statusId) {
        statusIds.add(statusId);
      }
    }
  }

  return statusIds;
};

const resolvePromiseStatus = (
  promise: PromiseItem,
  statusById: StatusById
): PromiseStatus | null => {
  const statusRef = promise.status;

  if (statusRef) {
    if (typeof statusRef === "string") {
      const mapped = statusById.get(statusRef);
      if (mapped) {
        return mapped;
      }
    } else {
      return statusRef;
    }
  }
  return null;
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
  const summariesList = Array.from(summaries.values());

  if (summariesList.length === 0) {
    return [];
  }

  const groups: { title: string; statuses: HeroStatusSummary[] }[] = [];
  const usedIds = new Set<string>();
  const hasCustomGroups = Boolean(blockGroups?.length);

  const addGroup = (title: string, statuses: HeroStatusSummary[]) => {
    if (statuses.length === 0) {
      return;
    }

    groups.push({ title, statuses });
    statuses.forEach((status) => usedIds.add(status.id));
  };

  if (blockGroups?.length) {
    for (const group of blockGroups.slice(0, 3)) {
      const statuses: HeroStatusSummary[] = [];

      for (const statusRef of group.statuses ?? []) {
        const statusId =
          typeof statusRef === "string" ? statusRef : statusRef.id;
        const summary = statusId ? summaries.get(statusId) : undefined;

        if (summary) {
          statuses.push(summary);
        }
      }

      if (statuses.length > 0) {
        const groupTitle = group.title?.trim() || statuses[0]?.label || "";
        addGroup(groupTitle, statuses);
      }
    }
  }

  if (groups.length === 0) {
    const summaryByLabel = new Map(
      summariesList.map((summary) => [
        summary.label.trim().toLowerCase(),
        summary,
      ])
    );

    for (const definition of FALLBACK_GROUP_DEFINITIONS) {
      const statuses: HeroStatusSummary[] = [];

      for (const label of definition.labels) {
        const summary = summaryByLabel.get(label.trim().toLowerCase());
        if (summary) {
          statuses.push(summary);
        }
      }

      addGroup(definition.title, statuses);
    }
  }

  if (groups.length === 0) {
    const sortedByCount = summariesList
      .slice()
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const groupCount = Math.min(3, sortedByCount.length);

    for (let index = 0; index < groupCount; index += 1) {
      const status = sortedByCount[index];
      addGroup(status.label, [status]);
    }
  }

  const untouched = summariesList.filter((summary) => !usedIds.has(summary.id));

  const shouldDistributeUntouched = !hasCustomGroups;

  if (shouldDistributeUntouched && untouched.length > 0 && groups.length > 0) {
    const sortedUntouched = untouched
      .slice()
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    for (const status of sortedUntouched) {
      let targetIndex = 0;
      let targetSize = groups[0].statuses.length;
      let targetTotal = groups[0].statuses.reduce(
        (total, item) => total + item.count,
        0
      );

      for (let index = 1; index < groups.length; index += 1) {
        const current = groups[index];
        const currentSize = current.statuses.length;
        const currentTotal = current.statuses.reduce(
          (total, item) => total + item.count,
          0
        );

        if (
          currentSize < targetSize ||
          (currentSize === targetSize && currentTotal < targetTotal)
        ) {
          targetIndex = index;
          targetSize = currentSize;
          targetTotal = currentTotal;
        }
      }

      groups[targetIndex].statuses.push(status);
    }
  }

  return groups.map((group) => ({
    title: group.title,
    statuses: group.statuses.map((status) => ({ ...status })),
  }));
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
  const locale = resolveEntityLocale(entity);

  const { docs: statusDocs } = await payload.find({
    collection: "promise-status",
    limit: -1,
    depth: 0,
    locale,
  });

  const selectedStatusIds = extractSelectedStatusIds(block.chartGroups);
  const filteredStatuses =
    selectedStatusIds.size > 0
      ? statusDocs.filter((status) => selectedStatusIds.has(status.id))
      : statusDocs;

  const statusById: StatusById = new Map(
    filteredStatuses.map((status) => [status.id, status])
  );
  const statusSummaries = buildStatusSummaries(filteredStatuses);

  const { docs: promiseDocs } = await payload.find({
    collection: "promises",
    where: {
      and: [
        {
          politicalEntity: {
            equals: entity.id,
          },
        },
        {
          publishStatus: {
            equals: "published",
          },
        },
      ],
    },
    limit: -1,
    depth: 1,
  });

  let totalPromises = 0;

  for (const promise of promiseDocs as PromiseItem[]) {
    const status = resolvePromiseStatus(promise, statusById);

    if (!status) {
      continue;
    }

    if (selectedStatusIds.size > 0 && !selectedStatusIds.has(status.id)) {
      continue;
    }

    const summary = statusSummaries.get(status.id);
    if (!summary) {
      continue;
    }

    summary.count += 1;
    totalPromises += 1;
  }

  statusSummaries.forEach((summary) => {
    summary.percentage =
      totalPromises > 0 ? (summary.count / totalPromises) * 100 : 0;
  });

  const groups = buildChartGroups(block.chartGroups, statusSummaries);

  const summaries: HeroStatusSummary[] = Array.from(
    statusSummaries.values()
  ).map((summary) => ({ ...summary }));

  const entityImage = await resolveMedia(entity.image);

  const taglineText = block.tagline?.trim();
  const headline = {
    tagline: taglineText || undefined,
    name: entity.name,
  };

  const profileTitleBase =
    block.profileTitleOverride?.trim() || entity.position;
  const profileTitle = profileTitleBase
    ? `${profileTitleBase} ${entity.name}`.trim()
    : entity.name;

  const copyPromiseLabel = block.promiseLabel?.trim() || "promises tracked";
  const copyTrailText = block.trailText?.trim() || "tracked on PromiseTracker.";
  const statusListTitle =
    block.statusListTitle?.trim() || "Promise status definitions";
  const tenantRecord =
    entity.tenant && typeof entity.tenant === "object"
      ? (entity.tenant as { name?: string | null })
      : null;
  const tenantName = tenantRecord?.name ?? undefined;
  const tenantHref = "/";
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
      total: totalPromises,
      statuses: summaries,
      groups,
    },
    navigation: {
      entitySlug,
      tenantName,
      tenantHref,
    },
  };

  return <HeroClient data={resolvedData} />;
};
