"use client";

import { Typography } from "@mui/material";
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

  return (
    <Grid container columnSpacing={2} rowSpacing={2} alignItems="flex-start">
      <Grid size={{ xs: 4 }}>
        <Typography
          variant="body2"
          sx={{
            color: statuses[0]?.color ?? "text.secondary",
            fontStyle: "italic",
          }}
        >
          {caption}
        </Typography>
      </Grid>
      <Grid size={{ xs: 8 }}>
        {statuses.map((status) => (
          <MobileSvgChart
            key={status.id}
            status={status}
            totalPromises={totalPromises}
          />
        ))}
      </Grid>
    </Grid>
  );
};

export default ProgressChart;
