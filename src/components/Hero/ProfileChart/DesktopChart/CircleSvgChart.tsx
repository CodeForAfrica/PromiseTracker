"use client";

import { Box, Typography } from "@mui/material";

import type { HeroStatusSummary } from "../../index";

type CircleSvgChartProps = {
  status: HeroStatusSummary;
  totalPromises: number;
};

const SIZE = 120;
const CENTER = SIZE / 2;

export const CircleSvgChart = ({ status, totalPromises }: CircleSvgChartProps) => {
  const percentage = totalPromises > 0 ? status.percentage : 0;
  const radius = Math.max((percentage * SIZE) / 200, 16);

  return (
    <Box sx={{ textAlign: "center" }}>
      <svg width={SIZE} height={SIZE} role="presentation">
        <circle
          cx={CENTER}
          cy={CENTER}
          r={radius}
          fill={status.color ?? "info.light"}
          stroke="#1D1D1B"
          strokeWidth={1}
        />
      </svg>
      <Box sx={{ pt: 1.5 }}>
        <Typography variant="h6" sx={{ color: "primary.dark" }}>
          {status.count}
        </Typography>
        <Typography
          variant="subtitle2"
          sx={{ color: "primary.main", textTransform: "capitalize" }}
        >
          {status.label.toLowerCase()}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {Math.round(percentage)}%
        </Typography>
      </Box>
    </Box>
  );
};

export default CircleSvgChart;
