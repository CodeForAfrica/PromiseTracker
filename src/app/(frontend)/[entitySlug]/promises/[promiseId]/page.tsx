import React from "react";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { Box, Button, Container, Grid, Typography } from "@mui/material";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import PromiseStatus from "@/components/PromiseStatus";
import PromiseTimeline from "@/components/PromiseTimeline";
import { CommonHomePage } from "@/components/CommonHomePage";
import { getDomain } from "@/lib/domain";
import { getTenantBySubDomain, getTenantNavigation } from "@/lib/data/tenants";
import { getPoliticalEntityBySlug } from "@/lib/data/politicalEntities";
import { getPromiseById } from "@/lib/data/promises";
import { resolveMedia } from "@/lib/data/media";
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

const formatDate = (value: string, locale: string) => {
  try {
    return new Intl.DateTimeFormat(locale || "en", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  } catch (_error) {
    return value;
  }
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

const getUniqueSections = (sections: Array<string | null | undefined>) => {
  const unique: string[] = [];
  sections.forEach((section) => {
    const value = section?.trim();
    if (value && !unique.includes(value)) {
      unique.push(value);
    }
  });
  return unique;
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

  const timelineInterval = computeTimelineInterval(
    { from: entity.periodFrom, to: entity.periodTo },
    timelineStatusHistory,
  );

  const image = await resolveMedia(promise.image ?? null);
  const locale = tenant.locale ?? "en";
  const formattedStatusDate = statusDate
    ? formatDate(statusDate, locale)
    : null;

  const titleText = promise.title?.trim() || "Promise";
  const originalArticleUrl = promise.url?.trim();

  const bodySections = getUniqueSections([promise.description]);
  const statusLabelText = "Promise rating status:";
  const timelineStatus = statusDoc
    ? {
        color: statusColor,
        label: statusDoc.label,
        textColor: statusTextColor,
        date: statusDate ?? undefined,
      }
    : null;

  return (
    <>
      <Navigation
        title={title}
        {...navigation}
        entitySlug={entity.slug}
        tenantSelectionHref={tenantSelectionHref}
      />
      <Box component="article" sx={{ bgcolor: "background.default" }}>
        {timelineStatus ? (
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
        ) : null}
        <Container
          disableGutters
          maxWidth="lg"
          sx={{
            width: "100%",
            px: { xs: 3, lg: 0 },
            py: { xs: 6, lg: 10 },
          }}
        >
          <Grid
            container
            columnSpacing={{ xs: 0, lg: 10 }}
            rowSpacing={{ xs: 6, lg: 0 }}
            alignItems="flex-start"
          >
            <Grid
              size={{ xs: 12, lg: 8 }}
              sx={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Typography
                variant="h5"
                sx={{
                  mb: 2,
                  mt: { xs: 4, lg: 6 },
                  fontSize: { xs: 14, lg: 16 },
                  fontWeight: 600,
                  letterSpacing: 1.2,
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
                    "&:hover": { textDecoration: "underline" },
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
                  mb: { xs: 3, lg: 4 },
                  pb: { lg: 1.5 },
                  position: { lg: "relative" },
                  ...(statusDoc
                    ? {
                        "&::after": {
                          content: '""',
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          width: "72px",
                          borderBottom: `8px solid ${statusColor}`,
                          display: { xs: "none", lg: "block" },
                        },
                      }
                    : {}),
                }}
              >
                {titleText}
              </Typography>
              <Box
                sx={{
                  width: "auto",
                  height: { xs: "210px", lg: "477px" },
                  border: {
                    xs: `6px solid ${statusColor}`,
                    lg: `10px solid ${statusColor}`,
                  },
                  backgroundImage: image
                    ? `linear-gradient(to right, ${statusColor}, ${statusColor}), url(${image.url})`
                    : `linear-gradient(to right, ${statusColor}, ${statusColor})`,
                  backgroundBlendMode: image ? "soft-light" : "normal",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  mb: { xs: 4, lg: 6 },
                }}
              />
              {statusDoc ? (
                <Box
                  sx={{
                    mt: { xs: 0, lg: 0 },
                    display: { xs: "flex", lg: "none" },
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderTop: "1px solid",
                    borderBottom: "1px solid",
                    borderColor: "secondary.light",
                    py: 2,
                    px: 1,
                    gap: 2,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {statusLabelText}
                  </Typography>
                  <PromiseStatus
                    {...statusDoc}
                    sx={{
                      mt: 0,
                      px: 3,
                      py: 1.25,
                      fontSize: 12,
                      letterSpacing: 1.2,
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  />
                </Box>
              ) : null}
              {statusDoc?.description ? (
                <Typography
                  variant="body2"
                  sx={{
                    display: { xs: "block", lg: "none" },
                    mt: 2,
                    color: "#202020",
                  }}
                >
                  {statusDoc.description}
                </Typography>
              ) : null}
              {formattedStatusDate ? (
                <Typography
                  variant="body2"
                  sx={{
                    display: { xs: "block", lg: "none" },
                    mt: 2,
                    color: "#202020",
                  }}
                >
                  Last updated {formattedStatusDate}
                </Typography>
              ) : null}
              {bodySections.map((section) => (
                <Typography
                  key={section}
                  variant="body1"
                  sx={{
                    mt: { xs: 3, lg: 4 },
                    color: "text.primary",
                    whiteSpace: "pre-line",
                  }}
                >
                  {section}
                </Typography>
              ))}
              {originalArticleUrl ? (
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
              ) : null}
              <Box
                sx={{
                  display: { xs: "block", lg: "none" },
                  mt: 6,
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ color: "#202020", mb: 1 }}
                >
                  {entity.position}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                  {entity.name}
                </Typography>
                <Typography variant="body2" sx={{ color: "#202020" }}>
                  Promise ID: {promise.id}
                </Typography>
              </Box>
            </Grid>
            <Grid
              size={{ xs: 12, lg: 4 }}
              sx={{
                display: { xs: "none", lg: "flex" },
                flexDirection: "column",
                gap: 6,
              }}
            >
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 500, mb: 2 }}>
                  {statusLabelText}
                </Typography>
                {statusDoc ? (
                  <>
                    <PromiseStatus
                      {...statusDoc}
                      sx={{
                        mt: 0,
                        px: 3,
                        py: 1.5,
                        fontSize: 12,
                        letterSpacing: 1.4,
                      }}
                    />
                    {statusDoc.description ? (
                      <Typography
                        variant="body2"
                        sx={{ mt: 2, color: "#202020" }}
                      >
                        {statusDoc.description}
                      </Typography>
                    ) : null}
                    {formattedStatusDate ? (
                      <Typography
                        variant="body2"
                        sx={{ mt: 2, color: "#202020" }}
                      >
                        Last updated {formattedStatusDate}
                      </Typography>
                    ) : null}
                  </>
                ) : (
                  <Typography variant="body2" sx={{ color: "#202020" }}>
                    Status coming soon.
                  </Typography>
                )}
              </Box>
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    color: "#202020",
                    mb: 1,
                    textTransform: "uppercase",
                    fontWeight: 900,
                    fontSize: "24px !important",
                  }}
                >
                  {entity.position}
                </Typography>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 600, mb: 1, fontSize: "20px !important" }}
                >
                  {entity.name}
                </Typography>
                <Typography variant="body2" sx={{ color: "#202020" }}>
                  Promise ID: {promise.id}
                </Typography>
              </Box>
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
