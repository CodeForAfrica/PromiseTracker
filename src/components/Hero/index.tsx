import { getGlobalPayload } from "@/lib/payload";
import type {
  HeroBlock,
  Media,
  PoliticalEntity,
  Promise as PromiseDocument,
  PromiseStatus,
} from "@/payload-types";
import { format } from "date-fns";
import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical";
import type { BasePayload } from "payload";

import { HeroClient } from "./Hero.Client";

export type HeroStatusCategory = "kept" | "uncertain" | "notKept" | "other";

export type HeroStatusSummary = {
  id: string;
  label: string;
  description: string;
  color?: string | null;
  textColor?: string | null;
  count: number;
  percentage: number;
  category: HeroStatusCategory;
};

export type HeroInfoItem = {
  title: string;
  description: string;
  color?: string | null;
};

export type HeroResolvedData = {
  tagline?: DefaultTypedEditorState | null;
  copy: {
    promiseLabel: string;
    trailText?: string | null;
    updatedAtLabel: string;
    profileTitle: string;
    chartCaptions: {
      kept: string;
      uncertain: string;
      notKept: string;
    };
    statusInfo: {
      title?: string;
      items: HeroInfoItem[];
    };
  };
  entity: {
    name: string;
    fullName: string;
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
  };
};

type HeroBlockOverrides = {
  tagline?: DefaultTypedEditorState | null;
  promiseLabel?: string | null;
  trailText?: string | null;
  updatedAtLabel?: string | null;
  profileTitleOverride?: string | null;
  fallbackImage?: string | Media | null;
  statusInfo?: {
    title?: string | null;
    items?:
      | {
          title: string;
          description: string;
        }[]
      | null;
  } | null;
  chartCaptions?: {
    kept?: string | null;
    uncertain?: string | null;
    notKept?: string | null;
  } | null;
};

type HeroProps = HeroBlock &
  HeroBlockOverrides & {
    entitySlug?: string;
  };

type PopulatedPromise = PromiseDocument & {
  extractions?: NonNullable<PromiseDocument["extractions"]>;
};

type StatusById = Map<string, PromiseStatus>;

type ResolvedMedia = {
  url: string;
  alt: string;
} | null;

const STATUS_CATEGORY_MAP: Record<string, HeroStatusCategory> = {
  completed: "kept",
  "in progress": "kept",
  inconclusive: "uncertain",
  unstarted: "uncertain",
  stalled: "notKept",
  "behind schedule": "notKept",
};

const DEFAULT_PROMISE_LABEL = "promises";
const DEFAULT_TRAIL_TEXT = "tracked on PromiseTracker.";
const DEFAULT_UPDATED_AT_LABEL = "Last updated";
const DEFAULT_STATUS_INFO_TITLE = "Promise status definitions";
const DEFAULT_CHART_CAPTIONS = {
  kept: "Promise kept",
  uncertain: "Uncertain",
  notKept: "Promise not kept",
};

const resolveStatusCategory = (label: string): HeroStatusCategory => {
  const normalized = label.trim().toLowerCase();
  return STATUS_CATEGORY_MAP[normalized] ?? "other";
};

const resolveMedia = async (
  payload: BasePayload,
  media: string | Media | null | undefined
): Promise<ResolvedMedia> => {
  if (!media) {
    return null;
  }

  if (typeof media === "string") {
    try {
      const mediaDoc = await payload.findByID({
        collection: "media",
        id: media,
      });
      if (mediaDoc?.url) {
        return {
          url: mediaDoc.url,
          alt: mediaDoc.alt,
        };
      }
    } catch (error) {
      payload.logger.warn({
        error,
        message: "Failed to load media by ID while resolving hero image",
        mediaId: media,
      });
    }
    return null;
  }

  if (!media.url) {
    return null;
  }

  return {
    url: media.url,
    alt: media.alt,
  };
};

const pickLatestStatus = (
  promiseDoc: PromiseDocument,
  statusById: StatusById
): PromiseStatus | null => {
  const extractions = promiseDoc.extractions ?? [];
  for (let index = extractions.length - 1; index >= 0; index -= 1) {
    const extraction = extractions[index];
    const statusRef = extraction.Status;
    if (!statusRef) {
      continue;
    }

    if (typeof statusRef === "string") {
      const status = statusById.get(statusRef);
      if (status) {
        return status;
      }
    } else {
      return statusRef;
    }
  }

  return null;
};

const buildInfoItems = (
  statusInfo: HeroProps["statusInfo"],
  statuses: PromiseStatus[]
): HeroInfoItem[] => {
  if (statusInfo?.items?.length) {
    const statusByLabel = new Map(
      statuses.map((status) => [status.label.toLowerCase(), status])
    );

    return statusInfo.items.map((item) => {
      const status = statusByLabel.get(item.title.toLowerCase());
      return {
        title: item.title,
        description: item.description,
        color: status?.colors?.color ?? undefined,
      };
    });
  }

  return statuses.map((status) => ({
    title: status.label,
    description: status.description,
    color: status.colors?.color ?? undefined,
  }));
};

const formatUpdatedAt = (date: string): string => {
  try {
    return format(new Date(date), "MMMM d, yyyy");
  } catch (error) {
    return date;
  }
};

export const Hero = async ({ entitySlug, ...block }: HeroProps) => {
  if (!entitySlug) {
    return null;
  }

  const payload = await getGlobalPayload();

  const { docs: entityDocs } = await payload.find({
    collection: "political-entities",
    where: {
      slug: {
        equals: entitySlug,
      },
    },
    limit: 1,
    depth: 2,
  });

  const entity = entityDocs[0];

  if (!entity) {
    return null;
  }

  const { docs: statusDocs } = await payload.find({
    collection: "promise-status",
    limit: -1,
  });

  const statusById: StatusById = new Map(
    statusDocs.map((status) => [status.id, status])
  );

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

  const totalPromises = promiseDocs.length;
  const summaryMap = new Map<string, HeroStatusSummary>();

  // Ensure all statuses are present even if count is zero.
  for (const status of statusDocs) {
    summaryMap.set(status.id, {
      id: status.id,
      label: status.label,
      description: status.description,
      color: status.colors?.color ?? null,
      textColor: status.colors?.textColor ?? null,
      count: 0,
      percentage: 0,
      category: resolveStatusCategory(status.label),
    });
  }

  for (const promiseDoc of promiseDocs) {
    const status = pickLatestStatus(promiseDoc, statusById);
    if (!status) {
      continue;
    }

    const summary = summaryMap.get(status.id);
    if (!summary) {
      summaryMap.set(status.id, {
        id: status.id,
        label: status.label,
        description: status.description,
        color: status.colors?.color ?? null,
        textColor: status.colors?.textColor ?? null,
        count: 1,
        percentage: 0,
        category: resolveStatusCategory(status.label),
      });
      continue;
    }

    summary.count += 1;
  }

  const summaries = Array.from(summaryMap.values()).map((summary) => ({
    ...summary,
    percentage: totalPromises > 0 ? (summary.count / totalPromises) * 100 : 0,
  }));

  const profileImage =
    (await resolveMedia(payload, entity.image)) ??
    (await resolveMedia(payload, block.fallbackImage ?? null));

  const statusInfoItems = buildInfoItems(block.statusInfo, statusDocs);

  const resolvedData: HeroResolvedData = {
    tagline: block.tagline ?? null,
    copy: {
      promiseLabel: block.promiseLabel ?? DEFAULT_PROMISE_LABEL,
      trailText: block.trailText ?? DEFAULT_TRAIL_TEXT,
      updatedAtLabel: block.updatedAtLabel ?? DEFAULT_UPDATED_AT_LABEL,
      profileTitle:
        block.profileTitleOverride?.trim() || entity.position || entity.name,
      chartCaptions: {
        kept: block.chartCaptions?.kept ?? DEFAULT_CHART_CAPTIONS.kept,
        uncertain:
          block.chartCaptions?.uncertain ?? DEFAULT_CHART_CAPTIONS.uncertain,
        notKept: block.chartCaptions?.notKept ?? DEFAULT_CHART_CAPTIONS.notKept,
      },
      statusInfo: {
        title: block.statusInfo?.title ?? DEFAULT_STATUS_INFO_TITLE,
        items: statusInfoItems,
      },
    },
    entity: {
      name: entity.name,
      fullName: entity.name,
      position: entity.position,
      updatedAtISO: entity.updatedAt,
      updatedAtDisplay: formatUpdatedAt(entity.updatedAt),
      image: profileImage,
    },
    metrics: {
      total: totalPromises,
      statuses: summaries,
    },
  };

  return <HeroClient data={resolvedData} />;
};
