"use client";

import { useMemo, useState } from "react";
import { Box } from "@mui/material";

import type { HeroChartGroup, HeroStatusSummary } from "../index";
import DesktopChart from "./DesktopChart";
import MobileChart from "./MobileChart";
import ProfileDetails from "./ProfileDetails";
import RectChart from "./RectChart";

type ProfileChartProps = {
  headline: string;
  promiseLabel: string;
  trailText: string;
  name: string;
  position: string;
  totalPromises: number;
  statusListTitle: string;
  statuses: HeroStatusSummary[];
  groups: HeroChartGroup[];
  shareTitle: string;
};

export const ProfileChart = ({
  headline,
  promiseLabel,
  trailText,
  name,
  position,
  totalPromises,
  statusListTitle,
  statuses,
  groups,
  shareTitle,
}: ProfileChartProps) => {
  const [showRectChart, setShowRectChart] = useState(false);

  const orderedRectStatuses = useMemo(() => {
    return statuses
      .slice()
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [statuses]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ProfileDetails
        headline={headline}
        name={name}
        position={position}
        promiseLabel={promiseLabel}
        trailText={trailText}
        totalPromises={totalPromises}
        statusListTitle={statusListTitle}
        statuses={statuses}
        isAlternateChart={showRectChart}
        onToggleAlternateChart={() => setShowRectChart((prev) => !prev)}
        shareTitle={shareTitle}
      />
      <Box sx={{ flexGrow: 1, width: "100%" }}>
        <Box sx={{ display: { xs: "none", lg: "block" } }}>
          {showRectChart ? (
            <RectChart totalPromises={totalPromises} statuses={orderedRectStatuses} />
          ) : (
            <DesktopChart totalPromises={totalPromises} groups={groups} />
          )}
        </Box>
        <Box sx={{ display: { xs: "block", lg: "none" } }}>
          <MobileChart totalPromises={totalPromises} groups={groups} />
        </Box>
      </Box>
    </Box>
  );
};

export default ProfileChart;
