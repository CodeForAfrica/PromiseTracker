import React from "react";
import NextLink from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Box, Container, Grid, Stack, Typography, Button } from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import PromiseStatus from "@/components/PromiseStatus";
import PromiseTimeline from "@/components/PromiseTimeline";
import ActNowCard from "@/components/ActNowCard";
import { CommonHomePage } from "@/components/CommonHomePage";
import { getDomain } from "@/lib/domain";
import {
  getTenantBySubDomain,
  getTenantNavigation,
  getTenantSiteSettings,
} from "@/lib/data/tenants";
import { getPoliticalEntityBySlug } from "@/lib/data/politicalEntities";
import { getPromiseById } from "@/lib/data/promises";
import { resolveMedia } from "@/lib/data/media";
import { getPromiseUpdateContent } from "@/lib/data/promiseUpdates";
import {
  buildSeoMetadata,
  getEntitySeo,
  composeTitleSegments,
  resolveTenantSeoContext,
} from "@/lib/seo";
import type {
  Promise as PromiseDocument,
  PromiseStatus as PromiseStatusDocument,
} from "@/payload-types";

const FALLBACK_STATUS_COLOR = "#909090";
const FALLBACK_STATUS_TEXT_COLOR = "#202020";

type Params = {
  entitySlug: string;
  promiseId: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const paramsValue = await params;
  const { entitySlug, promiseId } = paramsValue;

  const { subdomain } = await getDomain();
  const tenantResolution = await resolveTenantSeoContext(subdomain);

  if (tenantResolution.status === "missing") {
    return tenantResolution.metadata;
  }

  const { tenant, tenantSettings, tenantSeo, tenantTitleBase } =
    tenantResolution.context;

  const politicalEntity = await getPoliticalEntityBySlug(tenant, entitySlug);
  if (!politicalEntity) {
    return buildSeoMetadata({
      meta: tenantSettings?.meta,
      defaults: tenantSeo,
    });
  }

  const { seo: entitySeo, positionRegion } = getEntitySeo({
    entity: politicalEntity,
    tenant,
    tenantSeo,
    tenantTitleBase,
  });

  const promise = await getPromiseById(promiseId);

  if (!promise) {
    return buildSeoMetadata({
      meta: politicalEntity.meta,
      defaults: entitySeo,
    });
  }

  const relation = promise.politicalEntity;
  const promiseEntityId =
    typeof relation === "string" ? relation : (relation?.id ?? null);

  if (!promiseEntityId || promiseEntityId !== politicalEntity.id) {
    return buildSeoMetadata({
      meta: politicalEntity.meta,
      defaults: entitySeo,
    });
  }

  const fallbackTitle =
    composeTitleSegments(
      promise.title?.trim() || tenantTitleBase || tenantSeo.title,
      politicalEntity.name,
      positionRegion
    ) ??
    entitySeo.title ??
    tenantSeo.title;

  return buildSeoMetadata({
    meta: promise.meta,
    defaults: {
      title: fallbackTitle,
      description:
        promise.description?.trim() ||
        entitySeo.description ||
        tenantSeo.description,
      image: promise.image ?? entitySeo.image ?? tenantSeo.image,
    },
  });
}

const parseYear = (value?: string | null): number | null => {
  if (!value) {
    return null;
  }
  const year = new Date(value).getFullYear();
  return Number.isNaN(year) ? null : year;
};

const computeTimelineInterval = (
  entityPeriod: { from?: string | null; to?: string | null },
  statusHistory: { date: string }[]
): [number, number] => {
  const start = parseYear(entityPeriod.from);
  const end = parseYear(entityPeriod.to);

  if (start !== null && end !== null && end > start) {
    return [start, end];
  }

  const years = statusHistory
    .map((status) => parseYear(status.date))
    .filter((year): year is number => year !== null);

  if (years.length) {
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    return minYear === maxYear ? [minYear, minYear + 1] : [minYear, maxYear];
  }

  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear + 1];
};

const buildStatusDocument = (
  promise: PromiseDocument
): PromiseStatusDocument | null => {
  const relation = promise.status;
  if (!relation) {
    return null;
  }

  if (typeof relation !== "string") {
    return relation;
  }

  return null;
};

export default async function PromiseDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const paramsValue = await params;
  const { entitySlug, promiseId } = paramsValue;

  const { subdomain, tenantSelectionHref } = await getDomain();
  const tenant = await getTenantBySubDomain(subdomain);

  if (!tenant) {
    return <CommonHomePage />;
  }

  const { title, description, navigation, footer } =
    await getTenantNavigation(tenant);

  const entity = await getPoliticalEntityBySlug(tenant, entitySlug);

  if (!entity) {
    return notFound();
  }

  const promise = await getPromiseById(promiseId);

  if (!promise) {
    return notFound();
  }

  const promiseEntityId =
    typeof promise.politicalEntity === "string"
      ? promise.politicalEntity
      : (promise.politicalEntity?.id ?? null);

  if (!promiseEntityId || promiseEntityId !== entity.id) {
    return notFound();
  }

  const statusDoc = buildStatusDocument(promise);
  const statusColor = statusDoc?.colors?.color || FALLBACK_STATUS_COLOR;
  const statusTextColor =
    statusDoc?.colors?.textColor || FALLBACK_STATUS_TEXT_COLOR;

  const statusDate = promise.updatedAt || promise.createdAt;

  const timelineStatusHistory = statusDate
    ? [
        {
          color: statusColor,
          label: statusDoc?.label,
          textColor: statusTextColor,
          date: statusDate,
        },
      ]
    : [];

  const siteSettings = await getTenantSiteSettings(tenant);
  const promiseUpdateContent = await getPromiseUpdateContent();

  const { actNow } = siteSettings || {};
  const timelineInterval = computeTimelineInterval(
    { from: entity.periodFrom, to: entity.periodTo },
    timelineStatusHistory
  );

  const image = await resolveMedia(promise.image ?? null);
  const entityImage = await resolveMedia(entity.image ?? null);
  const titleText = promise.title?.trim() || "Promise";
  const descriptionText = promise.description?.trim() || null;
  const timelineStatus = {
    color: statusColor,
    label: statusDoc?.label,
    textColor: statusTextColor,
    date: statusDate ?? undefined,
  };

  return (
    <>
      <Navigation
        title={title}
        {...navigation}
        entitySlug={entity.slug}
        tenantSelectionHref={tenantSelectionHref}
      />
      <Box component="article" sx={{ bgcolor: "background.default" }}>
        <Container
          disableGutters
          maxWidth="lg"
          sx={{
            width: "100%",
            px: { xs: 3, lg: 0 },
            py: { xs: 6, lg: 8 },
          }}
        >
          <Stack spacing={{ xs: 4, lg: 6 }}>
            <Stack spacing={2} sx={{ maxWidth: { lg: "50%" } }}>
              <Button
                component={NextLink}
                href={`/${entity.slug}/promises`}
                startIcon={
                  <ArrowBackIosNewRoundedIcon
                    fontSize="small"
                    sx={{ transform: "translateY(-1px)" }}
                  />
                }
                sx={{
                  alignSelf: "flex-start",
                  px: 0,
                  color: "text.primary",
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": {
                    backgroundColor: "transparent",
                    textDecoration: "underline",
                  },
                }}
              >
                {entity.name}
              </Button>
              {statusDoc ? (
                <PromiseStatus
                  {...statusDoc}
                  sx={{
                    mt: 0,
                    px: 4,
                    py: 1.5,
                    fontSize: 12,
                    letterSpacing: 1.6,
                    alignSelf: "flex-start",
                  }}
                />
              ) : null}
              <Typography
                component="h1"
                sx={{
                  typography: { xs: "h3", lg: "h1" },
                  fontWeight: 600,
                  lineHeight: 1.1,
                  position: "relative",
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    bottom: -16,
                    left: 0,
                    width: "72px",
                    borderBottom: `8px solid ${statusColor}`,
                  },
                }}
              >
                {titleText}
              </Typography>
            </Stack>

            <Grid container spacing={{ xs: 6, lg: 8 }} alignItems="stretch">
              <Grid size={{ xs: 12, lg: 6 }}>
                {image ? (
                  <Box
                    component="figure"
                    sx={{
                      position: "relative",
                      m: 0,
                      width: "100%",
                      overflow: "hidden",
                      border: {
                        xs: `6px solid ${statusColor}`,
                        lg: `10px solid ${statusColor}`,
                      },
                      borderRadius: 0,
                      aspectRatio: { xs: "4 / 3", lg: "3 / 2" },
                    }}
                  >
                    <Image
                      src={image.url}
                      alt={image.alt || titleText}
                      fill
                      style={{ objectFit: "cover" }}
                    />
                  </Box>
                ) : null}
                {descriptionText ? (
                  <Typography
                    variant="body1"
                    sx={{
                      mt: { xs: 4, lg: 5 },
                      color: "text.primary",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {descriptionText}
                  </Typography>
                ) : null}
                <PromiseTimeline
                  status={timelineStatus}
                  statusHistory={timelineStatusHistory}
                  events={[]}
                  interval={timelineInterval}
                  sx={{
                    mt: { xs: 5, lg: 6 },
                    width: "100%",
                    maxWidth: "100%",
                    minHeight: { xs: 120, sm: 140, lg: 160 },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, lg: 6 }}>
                <ActNowCard
                  {...actNow}
                  updateContent={promiseUpdateContent}
                  entity={{
                    name: entity.name,
                    position: entity.position,
                    region: entity.region ?? null,
                    image: entityImage,
                  }}
                  sx={{
                    width: "100%",
                  }}
                />
              </Grid>
            </Grid>
          </Stack>
        </Container>
      </Box>
      <Footer
        title={title}
        description={description}
        {...footer}
        entitySlug={entity.slug}
      />
    </>
  );
}
