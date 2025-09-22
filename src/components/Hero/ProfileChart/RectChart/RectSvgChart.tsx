"use client";

import { Box, SxProps, Typography } from "@mui/material";

import type { HeroStatusSummary } from "../../index";

type RectSvgChartProps = {
  status: HeroStatusSummary;
  totalPromises: number;
  containerWidth: number;
  sx?: SxProps;
};

const HEIGHT = 160;
const MIN_WIDTH = 40;

export const RectSvgChart = ({
  status,
  totalPromises,
  containerWidth,
  sx,
}: RectSvgChartProps) => {
  if (totalPromises === 0 || status.count === 0 || containerWidth <= 0) {
    return null;
  }

  const percentage = totalPromises > 0 ? status.percentage : 0;
  const availableWidth = Math.max(containerWidth / 6, MIN_WIDTH);
  const width = Math.max((percentage / 100) * containerWidth, availableWidth);

  return (
    <Box sx={[{ textAlign: "center" }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <svg width={width} height={HEIGHT} role="presentation">
        <rect
          x={0}
          y={0}
          width={width}
          height={HEIGHT}
          rx={8}
          ry={8}
          fill={status.color ?? "info.light"}
          stroke="#1D1D1B"
          strokeWidth={1}
        />
      </svg>
      <Box sx={{ pt: 1 }}>
        <Typography
          variant="h3"
          sx={{
            fontSize: 24,
            fontWeight: "normal",
          }}
        >
          {Math.round(percentage)}%
        </Typography>
        <Typography
          variant="h4"
          sx={{
            textTransform: "capitalize",
            color: "primary.main",
            fontWeight: 400,
          }}
        >
          {status.label.toLowerCase()}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: "#909090",
          }}
        >
          {status.count}
        </Typography>
      </Box>
    </Box>
  );
};

export default RectSvgChart;
