"use client";

import { useMemo } from "react";
import BarChartIcon from "@mui/icons-material/BarChart";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import Grid from "@mui/material/Grid";
import { Box, IconButton, Stack, Typography } from "@mui/material";

import type { HeroStatusSummary } from "../index";
import Share from "@/components/Share";
import DesktopInfoStatusPopover from "./DesktopInfoStatusPopover";
import MobileInfoStatusPopover from "./MobileInfoStatusPopover";

type ProfileDetailsProps = {
  headline: string;
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
  trailText: string,
) => {
  const pieces = [
    `${position} ${name}`.trim(),
    totalPromises > 0 ? `${totalPromises} ${promiseLabel}`.trim() : undefined,
    trailText.trim().length > 0 ? trailText.trim() : undefined,
  ].filter(Boolean);

  return pieces.join(" ");
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
    [position, name, totalPromises, promiseLabel, trailText],
  );

  return (
    <Grid
      container
      columnSpacing={{ xs: 2, lg: 3 }}
      rowSpacing={{ xs: 2, lg: 3 }}
      alignItems="stretch"
      sx={{ mb: { xs: 2, lg: 3 } }}
    >
      <Grid size={{ xs: 12, lg: 8 }}>
        <Stack spacing={1.5}>
          {headline ? (
            <Typography
              component="h1"
              variant="h1"
              color="primary.dark"
              sx={{ display: { xs: "none", lg: "block" } }}
            >
              {headline}
            </Typography>
          ) : null}
          <Typography variant="body2" color="text.primary">
            {summary}
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
                isAlternateChart ? "Show circular chart" : "Show comparison chart"
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
              sx: (theme) => ({
                backgroundColor: theme.palette.secondary.light,
                width: theme.typography.pxToRem(40),
                height: theme.typography.pxToRem(40),
                "&:hover": {
                  backgroundColor: theme.palette.secondary.main,
                },
              }),
            }}
          />
        </Stack>
      </Grid>
    </Grid>
  );
};

export default ProfileDetails;
