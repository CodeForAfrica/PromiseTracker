"use client";

import { Box, Typography } from "@mui/material";

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
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        alignItems: "center",
        width: "100%",
        gap: 1.5,
      }}
    >
      <Box
        component="svg"
        width="100%"
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="presentation"
        sx={{ justifySelf: "center" }}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill={status.color ?? "#90DAFF"}
          stroke="#1D1D1B"
          strokeWidth={1}
        />
      </Box>
      <Typography variant="h6" sx={{ textAlign: "center" }}>
        {status.count}
      </Typography>
      <Typography variant="h6" sx={{ textAlign: "center" }}>
        ({Math.round(percentage)}%)
      </Typography>
      <Typography
        variant="body2"
        sx={{
          textTransform: "capitalize",
          textAlign: "right",
        }}
      >
        {status.label.toLowerCase()}
      </Typography>
    </Box>
  );
};

export default MobileSvgChart;
