"use client";

import { Box, Divider } from "@mui/material";
import Grid from "@mui/material/Grid";

import ProgressChart from "./ProgressChart";
import { HeroStatusSummary } from "../..";

type ChartCaptions = {
  kept: string;
  uncertain: string;
  notKept: string;
};

type DesktopChartProps = {
  totalPromises: number;
  chartCaptions: ChartCaptions;
  kept: HeroStatusSummary[];
  uncertain: HeroStatusSummary[];
  notKept: HeroStatusSummary[];
};

export const DesktopChart = ({
  totalPromises,
  chartCaptions,
  kept,
  uncertain,
  notKept,
}: DesktopChartProps) => {
  return (
    <Grid
      container
      sx={(theme) => ({
        borderRadius: theme.typography.pxToRem(8),
        border: `1px solid ${theme.palette.divider}`,
        p: theme.typography.pxToRem(24),
      })}
      columnSpacing={{ xs: 0, md: 4 }}
      rowSpacing={4}
      alignItems="stretch"
      wrap="nowrap"
    >
      <Grid size={{ xs: 12, md: 4 }}>
        <ProgressChart
          caption={chartCaptions.kept}
          statuses={kept}
          totalPromises={totalPromises}
        />
      </Grid>
      <Grid
        size={{ md: "auto" }}
        sx={{ display: { xs: "none", md: "flex" }, alignItems: "stretch" }}
      >
        <Box sx={{ display: "flex", alignItems: "stretch" }}>
          <Divider orientation="vertical" flexItem />
        </Box>
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <ProgressChart
          caption={chartCaptions.uncertain}
          statuses={uncertain}
          totalPromises={totalPromises}
        />
      </Grid>
      <Grid
        size={{ md: "auto" }}
        sx={{ display: { xs: "none", md: "flex" }, alignItems: "stretch" }}
      >
        <Box sx={{ display: "flex", alignItems: "stretch" }}>
          <Divider orientation="vertical" flexItem />
        </Box>
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <ProgressChart
          caption={chartCaptions.notKept}
          statuses={notKept}
          totalPromises={totalPromises}
        />
      </Grid>
    </Grid>
  );
};

export default DesktopChart;
