import { Card, CardContent, Container, Typography } from "@mui/material";
import type {
  PoliticalEntity,
  PromiseStatus,
  EntityPage,
} from "@/payload-types";
import { resolveMedia } from "@/lib/data/media";
import { getDomain } from "@/lib/domain";
import { getTenantBySubDomain } from "@/lib/data/tenants";
import { getGlobalPayload } from "@/lib/payload";
import { resolveTenantLocale } from "@/utils/locales";
import {
  getPoliticalEntitiesByTenant,
  getPromiseCountsForEntities,
} from "@/lib/data/politicalEntities";
import {
  PoliticalEntityListClient,
  type PoliticalEntityListClientProps,
} from "./PoliticalEntityList.client";

type StatusGroupConfig = {
  title?: string | null;
  color?: string | null;
  statuses?: (string | PromiseStatus)[];
};

type EntitySelectionBlock = Extract<
  EntityPage["entitySelector"]["blocks"][number],
  { blockType: "entity-selection" }
> & {
  pageSlugs?: string[];
  statusGroups?: StatusGroupConfig[];
};

type PoliticalEntityListProps = EntitySelectionBlock;

type NormalizedStatusGroup =
  PoliticalEntityListClientProps["statusGroups"][number];

const buildHref = (entity: PoliticalEntity, pageSlugs: string[] = []) => {
  const entitySlug = entity.slug?.trim();
  if (!entitySlug) {
    return "/";
  }

  const baseSegments = pageSlugs.filter((slug) => slug && slug !== "index");

  const segments = [entitySlug, ...baseSegments];
  return `/${segments.join("/")}`;
};

export const PoliticalEntityList = async ({
  pageSlugs = [],
  emptyTitle,
  EmptySubtitle,
  title,
  statusGroups: configuredStatusGroups = [],
}: PoliticalEntityListProps) => {
  const { subdomain } = await getDomain();
  const tenant = await getTenantBySubDomain(subdomain);

  if (!tenant) {
    return null;
  }
  const locale = resolveTenantLocale(tenant);

  const politicalEntities = await getPoliticalEntitiesByTenant(tenant, locale);

  if (!politicalEntities.length) {
    return (
      <Container component="section" sx={{ py: { xs: 6, md: 8 } }}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {emptyTitle}
            </Typography>
            <Typography variant="body2">{EmptySubtitle}</Typography>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const payload = await getGlobalPayload();

  const [promiseCounts, statusDocsResult] = await Promise.all([
    getPromiseCountsForEntities(politicalEntities.map((entity) => entity.id)),
    payload.find({
      collection: "promise-status",
      limit: -1,
      depth: 0,
      locale,
    }),
  ]);

  const statusDocs = (statusDocsResult?.docs ?? []) as PromiseStatus[];
  const statusById = new Map(statusDocs.map((status) => [status.id, status]));

  const configuredGroups = configuredStatusGroups ?? [];

  const statusGroups: NormalizedStatusGroup[] = configuredGroups
    .map((group, index) => {
      const statuses: PromiseStatus[] = [];
      const statusIds: string[] = [];

      for (const statusRef of group?.statuses ?? []) {
        if (!statusRef) {
          continue;
        }

        const statusId =
          typeof statusRef === "string" ? statusRef : statusRef.id;
        if (!statusId) {
          continue;
        }

        const resolved =
          statusById.get(statusId) ||
          (typeof statusRef === "object" ? (statusRef as PromiseStatus) : null);

        if (resolved) {
          statuses.push(resolved);
          statusIds.push(resolved.id);
        }
      }

      if (statuses.length === 0) {
        return null;
      }

      const titleText = group?.title?.trim() || statuses[0].label;
      const groupColorRaw =
        typeof group?.color === "string" ? group.color.trim() : "";
      const resolvedColor =
        groupColorRaw ||
        statuses[0].colors?.textColor ||
        statuses[0].colors?.color ||
        "#000000";

      return {
        id: `group-${index}-${statuses[0].id}`,
        title: titleText,
        color: resolvedColor,
        statusIds,
      };
    })
    .filter((group): group is NormalizedStatusGroup => Boolean(group));

  if (statusGroups.length === 0) {
    statusDocs.slice(0, 3).forEach((status, index) => {
      statusGroups.push({
        id: `fallback-${status.id}-${index}`,
        title: status.label,
        color: status.colors?.textColor || status.colors?.color || "#000000",
        statusIds: [status.id],
      });
    });
  }

  const sortedPoliticalEntities = [...politicalEntities].sort(
    (entityA, entityB) => {
      const orderA = entityA.order ?? Number.POSITIVE_INFINITY;
      const orderB = entityB.order ?? Number.POSITIVE_INFINITY;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return entityA.name.localeCompare(entityB.name, undefined, {
        sensitivity: "base",
      });
    }
  );

  const entitiesWithMedia = await Promise.all(
    sortedPoliticalEntities.map(async (entity) => ({
      entity,
      media: await resolveMedia(entity.image),
    }))
  );

  const listItems: PoliticalEntityListClientProps["items"] =
    entitiesWithMedia.map(({ entity, media }) => {
      const summary = promiseCounts[entity.id] ?? {
        total: 0,
        statuses: {},
      };

      const initials = entity.name
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");

      const filterKey = entity.position?.trim() || "Other";

      return {
        id: entity.id,
        href: buildHref(entity, pageSlugs),
        name: entity.name,
        position: entity.position,
        region: entity.region ?? null,
        initials,
        avatar: {
          url: media?.url ?? null,
          alt: media?.alt ?? entity.name,
        },
        totalPromises: summary.total ?? 0,
        statusCounts: { ...(summary.statuses ?? {}) },
        filterKey,
      };
    });

  const positionCounts = listItems.reduce<Record<string, number>>(
    (accumulator, item) => {
      const label = item.filterKey;
      accumulator[label] = (accumulator[label] ?? 0) + 1;
      return accumulator;
    },
    {}
  );

  const filterOptions: PoliticalEntityListClientProps["filterOptions"] = [
    { key: "all", label: "All", count: listItems.length },
    ...Object.entries(positionCounts).map(([key, count]) => ({
      key,
      label: key,
      count,
    })),
  ];

  const statusDefinitions: PoliticalEntityListClientProps["statusDefinitions"] =
    statusDocs.map((status) => ({
      id: status.id,
      label: status.label,
      description: status.description ?? "",
      color: status.colors?.color ?? null,
      textColor: status.colors?.textColor ?? null,
    }));

  return (
    <Container component="section" sx={{ py: { xs: 5, md: 6 } }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        {title}
      </Typography>
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <PoliticalEntityListClient
            statusGroups={statusGroups}
            filterOptions={filterOptions}
            items={listItems}
            statusDefinitions={statusDefinitions}
          />
        </CardContent>
      </Card>
    </Container>
  );
};
