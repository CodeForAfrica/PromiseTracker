"use client";

import { Box, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";

import type { HeroStatusSummary } from "../../index";
import MobileSvgChart from "./MobileSvgChart";

type ProgressChartProps = {
  caption: string;
  statuses: HeroStatusSummary[];
  totalPromises: number;
};

export const ProgressChart = ({
  caption,
  statuses,
  totalPromises,
}: ProgressChartProps) => {
  if (!statuses.length) {
    return null;
  }

  const accentColor = statuses[0]?.color;

  return (
    <Grid container columnSpacing={2} rowSpacing={2} alignItems="stretch">
      <Grid size={{ xs: 4 }}>
        <Box
          sx={(theme) => ({
            height: "100%",
            borderRight: `3px solid ${accentColor ?? theme.palette.divider}`,
            pr: theme.typography.pxToRem(12),
            minHeight: theme.typography.pxToRem(70),
            display: "flex",
            alignItems: "center",
          })}
        >
          <Typography
            variant="body2"
            sx={(theme) => ({
              color: accentColor ?? theme.palette.text.secondary,
              fontStyle: "italic",
              whiteSpace: "pre-line",
            })}
          >
            {caption}
          </Typography>
        </Box>
      </Grid>
      <Grid size={{ xs: 8 }}>
        <Stack spacing={1.5} sx={{ width: "100%" }}>
          {statuses.map((status) => (
            <MobileSvgChart
              key={status.id}
              status={status}
              totalPromises={totalPromises}
            />
          ))}
        </Stack>
      </Grid>
    </Grid>
  );
};

export default ProgressChart;
