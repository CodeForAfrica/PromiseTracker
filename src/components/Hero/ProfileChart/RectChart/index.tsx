"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Stack } from "@mui/material";

import type { HeroStatusSummary } from "../../index";
import RectSvgChart from "./RectSvgChart";

type RectChartProps = {
  totalPromises: number;
  statuses: HeroStatusSummary[];
};

export const RectChart = ({ totalPromises, statuses }: RectChartProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    setContainerWidth(containerRef.current.offsetWidth);
  }, []);

  if (!statuses.length || totalPromises === 0) {
    return null;
  }

  return (
    <Box ref={containerRef} sx={{ width: "100%", py: 3 }}>
      <Stack direction="row" alignItems="flex-end" sx={{ overflowX: "auto" }}>
        {statuses.map((status) => (
          <RectSvgChart
            key={status.id}
            status={status}
            totalPromises={totalPromises}
            containerWidth={containerWidth}
          />
        ))}
      </Stack>
    </Box>
  );
};

export default RectChart;
