"use client";

import { Box, Stack, Typography } from "@mui/material";

import type { HeroStatusSummary } from "../../index";
import CircleSvgChart from "./CircleSvgChart";

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

  const accentColor = statuses[0]?.color ?? "";

  return (
    <Stack spacing={2} alignItems="stretch" sx={{ px: 2 }}>
      <Typography
        variant="caption"
        sx={(theme) => ({
          color: accentColor || theme.palette.text.secondary,
          fontStyle: "italic",
          textAlign: "center",
        })}
      >
        {caption}
      </Typography>
      <Box
        sx={(theme) => ({
          borderTop: `3px solid ${accentColor || theme.palette.divider}`,
          borderRadius: theme.typography.pxToRem(1),
          width: "100%",
        })}
      />
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          gap: 3,
          justifyContent: "center",
        }}
      >
        {statuses.map((status) => (
          <CircleSvgChart
            key={status.id}
            status={status}
            totalPromises={totalPromises}
          />
        ))}
      </Box>
    </Stack>
  );
};

export default ProgressChart;
