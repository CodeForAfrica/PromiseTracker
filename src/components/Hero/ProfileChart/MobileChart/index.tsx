"use client";

import { Stack } from "@mui/material";

import type { HeroStatusSummary } from "../../index";
import ProgressChart from "./ProgressChart";

type ChartCaptions = {
  kept: string;
  uncertain: string;
  notKept: string;
};

type MobileChartProps = {
  chartCaptions: ChartCaptions;
  totalPromises: number;
  kept: HeroStatusSummary[];
  uncertain: HeroStatusSummary[];
  notKept: HeroStatusSummary[];
};

export const MobileChart = ({
  chartCaptions,
  totalPromises,
  kept,
  uncertain,
  notKept,
}: MobileChartProps) => {
  return (
    <Stack spacing={3} sx={{ width: "100%", py: 3 }}>
      <ProgressChart
        caption={chartCaptions.kept}
        statuses={kept}
        totalPromises={totalPromises}
      />
      <ProgressChart
        caption={chartCaptions.uncertain}
        statuses={uncertain}
        totalPromises={totalPromises}
      />
      <ProgressChart
        caption={chartCaptions.notKept}
        statuses={notKept}
        totalPromises={totalPromises}
      />
    </Stack>
  );
};

export default MobileChart;
