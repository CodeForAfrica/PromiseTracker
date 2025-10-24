import React from "react";
import NextLink from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Box, Container, Grid, Typography } from "@mui/material";

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
      positionRegion,
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
  statusHistory: { date: string }[],
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
  promise: PromiseDocument,
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

  const { actNow } = siteSettings || {};
  const timelineInterval = computeTimelineInterval(
    { from: entity.periodFrom, to: entity.periodTo },
    timelineStatusHistory,
  );

  const image = await resolveMedia(promise.image ?? null);
  const titleText = promise.title?.trim() || "Promise";
  const originalArticleUrl = promise.url?.trim();
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
        <Box sx={{ bgcolor: "secondary.light" }}>
          <Container
            disableGutters
            maxWidth="lg"
            sx={{
              px: { xs: 3, lg: 0 },
              py: { xs: 4, lg: 6 },
            }}
          >
            <PromiseTimeline
              status={timelineStatus}
              statusHistory={timelineStatusHistory}
              events={[]}
              interval={timelineInterval}
              sx={{ height: { xs: 120, lg: 140 } }}
            />
          </Container>
        </Box>
        <Container
          disableGutters
          maxWidth="lg"
          sx={{
            width: "100%",
            px: { xs: 3, lg: 0 },
            py: { xs: 6, lg: 10 },
          }}
        >
          <Grid container spacing={{ xs: 6, lg: 8 }} alignItems="flex-start">
            <Grid size={{ xs: 12, lg: 8 }}>
              <Typography
                variant="overline"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "#202020",
                }}
              >
                <Box
                  component={NextLink}
                  href={`/${entity.slug}/promises`}
                  sx={{
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  Promises
                </Box>
              </Typography>
              <Typography
                component="h1"
                sx={{
                  typography: { xs: "h3", lg: "h1" },
                  fontWeight: 600,
                  lineHeight: 1.1,
                  mt: 2,
                  mb: { xs: 4, lg: 5 },
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
              {image ? (
                <Box
                  component="figure"
                  sx={{
                    position: "relative",
                    width: "100%",
                    overflow: "hidden",
                    border: {
                      xs: `6px solid ${statusColor}`,
                      lg: `10px solid ${statusColor}`,
                    },
                    borderRadius: 0,
                    aspectRatio: { xs: "4 / 3", lg: "3 / 2" },
                    mb: { xs: 4, lg: 6 },
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
              <ActNowCard {...(actNow as any)} />
              {statusDoc ? (
                <Box
                  sx={{
                    display: { xs: "flex", lg: "none" },
                    justifyContent: "center",
                    mb: 4,
                  }}
                >
                  <PromiseStatus
                    {...statusDoc}
                    sx={{
                      mt: 0,
                      px: 5,
                      py: 2,
                      fontSize: { xs: 10, sm: 12 },
                      letterSpacing: 1.6,
                    }}
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
              {/* {originalArticleUrl ? (
                <Button
                  component="a"
                  href={originalArticleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  sx={{
                    alignSelf: { xs: "stretch", sm: "flex-start" },
                    mt: { xs: 4, lg: 5 },
                    textTransform: "none",
                  }}
                >
                  Read the full report
                </Button>
              ) : null} */}
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              {statusDoc ? (
                <Box
                  sx={{
                    borderRadius: 0,
                    bgcolor: "#ffffff",
                    pt: 4,
                    pb: 5,
                    px: 5,
                    maxWidth: { lg: 320 },
                    ml: { lg: "auto" },
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      fontSize: { xs: "0.875rem", lg: "1rem" },
                      fontWeight: 600,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      color: "#202020",
                    }}
                  >
                    Promise rating status:
                  </Typography>
                  <PromiseStatus
                    {...statusDoc}
                    sx={{
                      mt: 0,
                      px: 6,
                      py: 2.4,
                      fontSize: 12,
                      letterSpacing: 1.6,
                      borderRadius: 0,
                    }}
                  />
                </Box>
              ) : null}
            </Grid>
          </Grid>
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
