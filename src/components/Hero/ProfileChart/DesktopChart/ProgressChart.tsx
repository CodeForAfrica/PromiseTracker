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

  const captionColor = statuses[0]?.color ?? "text.secondary";

  return (
    <Stack spacing={2} alignItems="center" sx={{ px: 2 }}>
      <Typography
        variant="caption"
        sx={{
          color: captionColor,
          fontStyle: "italic",
          textAlign: "center",
        }}
      >
        {caption}
      </Typography>
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
