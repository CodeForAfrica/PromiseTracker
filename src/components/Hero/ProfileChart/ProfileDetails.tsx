"use client";

import { useMemo } from "react";
import BarChartIcon from "@mui/icons-material/BarChart";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import Grid from "@mui/material/Grid";
import { Box, IconButton, Stack, Theme, Typography } from "@mui/material";

import type { HeroStatusSummary } from "../index";
import Share from "@/components/Share";
import {
  DesktopInfoStatusPopover,
  MobileInfoStatusPopover,
} from "@/components/PromiseStatusInfo";

type ProfileDetailsProps = {
  headline: {
    tagline?: string;
    name: string;
  };
  name: string;
  position: string;
  promiseLabel: string;
  trailText: string;
  totalPromises: number;
  statusListTitle: string;
  statuses: HeroStatusSummary[];
  isAlternateChart: boolean;
  onToggleAlternateChart: () => void;
  shareTitle: string;
};

const buildSummary = (
  position: string,
  name: string,
  totalPromises: number,
  promiseLabel: string,
  trailText: string
) => {
  return {
    intro: `${position} ${name}`.trim(),
    highlight:
      totalPromises > 0 ? `${totalPromises} ${promiseLabel}`.trim() : undefined,
    outro: trailText.trim().length > 0 ? trailText.trim() : undefined,
  };
};

export const ProfileDetails = ({
  headline,
  name,
  position,
  promiseLabel,
  trailText,
  totalPromises,
  statusListTitle,
  statuses,
  isAlternateChart,
  onToggleAlternateChart,
  shareTitle,
}: ProfileDetailsProps) => {
  const summary = useMemo(
    () => buildSummary(position, name, totalPromises, promiseLabel, trailText),
    [position, name, totalPromises, promiseLabel, trailText]
  );

  return (
    <Grid
      container
      columnSpacing={{ xs: 2, lg: 3 }}
      rowSpacing={{ xs: 2, lg: 3 }}
      alignItems="stretch"
      sx={{ mb: { xs: 2, lg: 3 } }}
      flexWrap="nowrap"
    >
      <Grid size={{ xs: 12, lg: 8 }}>
        <Stack spacing={1.5}>
          {headline.tagline || headline.name ? (
            <Typography
              component="h1"
              variant="h1"
              sx={{ display: { xs: "none", lg: "block" } }}
            >
              {headline.tagline ? (
                <>
                  <Typography
                    component="span"
                    variant="inherit"
                    sx={{ color: "#005DFD" }}
                  >
                    {headline.tagline}
                  </Typography>{" "}
                  {headline.name}
                </>
              ) : (
                headline.name
              )}
            </Typography>
          ) : null}
          <Typography variant="body2" color="text.primary">
            {summary.intro}
            {summary.highlight ? " " : ""}
            {summary.highlight ? (
              <Typography
                component="span"
                variant="body2"
                sx={{ fontWeight: 700 }}
              >
                {summary.highlight}
              </Typography>
            ) : null}
            {summary.outro ? ` ${summary.outro}` : ""}
          </Typography>
        </Stack>
      </Grid>
      <Grid
        size={{ xs: 12, lg: 4 }}
        sx={{
          display: "flex",
          justifyContent: { xs: "flex-start", lg: "center" },
          alignItems: "center",
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ height: "100%" }}
        >
          <Box sx={{ display: { xs: "none", lg: "flex" } }}>
            <IconButton
              aria-label={
                isAlternateChart
                  ? "Show circular chart"
                  : "Show comparison chart"
              }
              size="small"
              onClick={onToggleAlternateChart}
              sx={(theme) => ({
                backgroundColor: theme.palette.secondary.light,
                width: theme.typography.pxToRem(40),
                height: theme.typography.pxToRem(40),
                "&:hover": {
                  backgroundColor: theme.palette.secondary.main,
                },
              })}
            >
              {isAlternateChart ? (
                <DonutLargeIcon fontSize="small" />
              ) : (
                <BarChartIcon fontSize="small" />
              )}
            </IconButton>
          </Box>
          <Box sx={{ display: { xs: "none", lg: "flex" } }}>
            <DesktopInfoStatusPopover
              title={statusListTitle}
              statuses={statuses}
            />
          </Box>
          <Box sx={{ display: { xs: "flex", lg: "none" } }}>
            <MobileInfoStatusPopover
              title={statusListTitle}
              statuses={statuses}
            />
          </Box>
          <Share
            title={shareTitle}
            iconButtonProps={{
              sx: (theme: Theme) => ({
                backgroundColor: theme.palette.secondary.light,
                width: theme.typography.pxToRem(40),
                height: theme.typography.pxToRem(40),
                "&:hover": {
                  backgroundColor: theme.palette.secondary.main,
                },
              }),
            }}
            link={""}
            children={undefined}
          />
        </Stack>
      </Grid>
    </Grid>
  );
};

export default ProfileDetails;
