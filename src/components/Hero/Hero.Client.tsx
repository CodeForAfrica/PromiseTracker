"use client";

import { Box, Container } from "@mui/material";
import Grid from "@mui/material/Grid";
import { RichText } from "@/components/RichText";
import { tokens } from "@/theme/tokens";
import type {
  HeroInfoItem,
  HeroResolvedData,
  HeroStatusSummary,
} from "./index";
import Profile from "./Profile";
import ProfileChart from "./ProfileChart";

const HIGHLIGHT_CLASS_SX = {
  "& .highlight": {
    color: "info.main",
  },
};

const groupStatusesByCategory = (statuses: HeroStatusSummary[]) => {
  const kept: HeroStatusSummary[] = [];
  const uncertain: HeroStatusSummary[] = [];
  const notKept: HeroStatusSummary[] = [];
  const other: HeroStatusSummary[] = [];

  statuses.forEach((status) => {
    switch (status.category) {
      case "kept":
        kept.push(status);
        break;
      case "uncertain":
        uncertain.push(status);
        break;
      case "notKept":
        notKept.push(status);
        break;
      default:
        other.push(status);
    }
  });

  return { kept, uncertain, notKept, other };
};

const DEFAULT_STATUS_ORDER = [
  "Completed",
  "In Progress",
  "Inconclusive",
  "Unstarted",
  "Behind Schedule",
  "Stalled",
];

const applyInfoItemColorFallback = (
  items: HeroInfoItem[],
  statuses: HeroStatusSummary[]
) => {
  if (!items.length) {
    return items;
  }

  const statusByLabel = new Map(
    statuses.map((status) => [status.label.toLowerCase(), status])
  );

  return items.map((item) => {
    const status = statusByLabel.get(item.title.toLowerCase());
    return {
      ...item,
      color: status?.color ?? item.color ?? null,
    };
  });
};

export type HeroClientProps = {
  data: HeroResolvedData;
};

export const HeroClient = ({ data }: HeroClientProps) => {
  const { entity, copy, metrics, tagline } = data;
  const statusGroups = groupStatusesByCategory(metrics.statuses);

  const statusInfoItems = applyInfoItemColorFallback(
    copy.statusInfo.items,
    metrics.statuses
  );

  const shareTitle =
    `${copy.profileTitle} ${entity.name} ${metrics.total} ${copy.promiseLabel} ${
      copy.trailText ?? ""
    }`.trim();

  return (
    <Box
      component="section"
      sx={(theme) => ({
        backgroundColor: "transparent",
        pt: theme.typography.pxToRem(22),
        pb: theme.typography.pxToRem(40),
        [theme.breakpoints.up("lg")]: {
          pt: theme.typography.pxToRem(80),
          pb: theme.typography.pxToRem(44),
        },
      })}
    >
      <Container maxWidth="lg">
        {tagline ? (
          <Box
            sx={(theme) => ({
              display: { xs: "block", lg: "none" },
              mb: theme.typography.pxToRem(24),
            })}
          >
            <RichText
              data={tagline}
              component="h1"
              sx={(theme) => ({
                ...HIGHLIGHT_CLASS_SX,
                color: theme.palette.primary.dark,
                typography: theme.typography.h1,
              })}
            />
          </Box>
        ) : null}
        <Grid
          container
          rowSpacing={{ xs: 3, lg: 6 }}
          columnSpacing={{ xs: 3, lg: 6 }}
          alignItems="stretch"
        >
          <Grid size={{ xs: 12, lg: 4 }}>
            <Profile
              name={entity.name}
              fullName={entity.fullName}
              updatedAtLabel={copy.updatedAtLabel}
              updatedAtDisplay={entity.updatedAtDisplay}
              profileTitle={copy.profileTitle}
              image={entity.image}
            />
          </Grid>
          <Grid size={{ xs: 12, lg: 8 }}>
            <ProfileChart
              tagline={tagline}
              promiseLabel={copy.promiseLabel}
              trailText={copy.trailText}
              name={entity.name}
              position={entity.position}
              totalPromises={metrics.total}
              chartCaptions={copy.chartCaptions}
              statusGroups={statusGroups}
              statusInfo={{
                title: copy.statusInfo.title,
                items: statusInfoItems,
              }}
              statuses={metrics.statuses}
              shareTitle={shareTitle}
              colorFallbacks={{
                kept: tokens.chart.complete,
                keptSecondary: tokens.chart.inprogress,
                uncertainPrimary: tokens.chart.inconclusive,
                uncertainSecondary: tokens.chart.unstarted,
                notKeptPrimary: tokens.chart.behindSchedule,
                notKeptSecondary: tokens.chart.stalled,
              }}
              statusOrder={DEFAULT_STATUS_ORDER}
            />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default HeroClient;
