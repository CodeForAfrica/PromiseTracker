"use client";

import { Stack } from "@mui/material";

import type { HeroChartGroup } from "../..";
import ProgressChart from "./ProgressChart";

type MobileChartProps = {
  totalPromises: number;
  groups: HeroChartGroup[];
};

export const MobileChart = ({ totalPromises, groups }: MobileChartProps) => {
  if (!groups.length) {
    return null;
  }

  return (
    <Stack spacing={3} sx={{ width: "100%", py: 3 }}>
      {groups.map((group) => (
        <ProgressChart
          key={group.title}
          caption={group.title}
          statuses={group.statuses}
          totalPromises={totalPromises}
        />
      ))}
    </Stack>
  );
};

export default MobileChart;
