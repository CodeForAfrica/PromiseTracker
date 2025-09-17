"use client";

import { Typography } from "@mui/material";
import Grid from "@mui/material/Grid";

import type { HeroStatusSummary } from "../../index";

type MobileSvgChartProps = {
  status: HeroStatusSummary;
  totalPromises: number;
};

const SIZE = 25;
const RADIUS = SIZE / 2 - 2;

export const MobileSvgChart = ({
  status,
  totalPromises,
}: MobileSvgChartProps) => {
  const percentage = totalPromises > 0 ? status.percentage : 0;

  return (
    <Grid
      container
      columnSpacing={2}
      alignItems="center"
      wrap="nowrap"
      sx={{ mb: 1 }}
    >
      <Grid size="auto">
        <svg width={SIZE} height={SIZE} role="presentation">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill={status.color ?? "info.light"}
            stroke="#1D1D1B"
            strokeWidth={1}
          />
        </svg>
      </Grid>
      <Grid size="auto">
        <Typography variant="h6">{status.count}</Typography>
      </Grid>
      <Grid size="auto">
        <Typography variant="h6">({Math.round(percentage)}%)</Typography>
      </Grid>
      <Grid size="auto">
        <Typography
          variant="subtitle2"
          sx={{
            textTransform: "capitalize",
            color: "text.secondary",
          }}
        >
          {status.label.toLowerCase()}
        </Typography>
      </Grid>
    </Grid>
  );
};

export default MobileSvgChart;
