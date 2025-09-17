"use client";

import { useMemo, useState } from "react";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical";

import type { HeroInfoItem, HeroStatusSummary } from "../index";
import DesktopChart from "./DesktopChart";
import MobileChart from "./MobileChart";
import ProfileDetails from "./ProfileDetails";
import RectChart from "./RectChart";

type StatusGroups = {
  kept: HeroStatusSummary[];
  uncertain: HeroStatusSummary[];
  notKept: HeroStatusSummary[];
  other: HeroStatusSummary[];
};

type ChartCaptions = {
  kept: string;
  uncertain: string;
  notKept: string;
};

type ChartColorFallbacks = {
  kept: string;
  keptSecondary: string;
  uncertainPrimary: string;
  uncertainSecondary: string;
  notKeptPrimary: string;
  notKeptSecondary: string;
};

type ProfileChartProps = {
  tagline?: DefaultTypedEditorState | null;
  promiseLabel: string;
  trailText?: string | null;
  name: string;
  position: string;
  totalPromises: number;
  chartCaptions: ChartCaptions;
  statusGroups: StatusGroups;
  statusInfo: {
    title?: string;
    items: HeroInfoItem[];
  };
  statuses: HeroStatusSummary[];
  shareTitle: string;
  colorFallbacks: ChartColorFallbacks;
  statusOrder: string[];
};

const ensureColors = (
  statuses: HeroStatusSummary[],
  fallbackPrimary: string,
  fallbackSecondary: string
) => {
  return statuses.map((status, index) => ({
    ...status,
    color: status.color ?? (index === 0 ? fallbackPrimary : fallbackSecondary),
  }));
};

export const ProfileChart = ({
  tagline,
  promiseLabel,
  trailText,
  name,
  position,
  totalPromises,
  chartCaptions,
  statusGroups,
  statusInfo,
  statuses,
  shareTitle,
  colorFallbacks,
  statusOrder,
}: ProfileChartProps) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [showRectChart, setShowRectChart] = useState(false);

  const keptWithFallback = useMemo(
    () =>
      ensureColors(
        statusGroups.kept,
        colorFallbacks.kept,
        colorFallbacks.keptSecondary
      ),
    [statusGroups.kept, colorFallbacks.kept, colorFallbacks.keptSecondary]
  );

  const uncertainWithFallback = useMemo(
    () =>
      ensureColors(
        statusGroups.uncertain,
        colorFallbacks.uncertainPrimary,
        colorFallbacks.uncertainSecondary
      ),
    [
      statusGroups.uncertain,
      colorFallbacks.uncertainPrimary,
      colorFallbacks.uncertainSecondary,
    ]
  );

  const notKeptWithFallback = useMemo(
    () =>
      ensureColors(
        statusGroups.notKept,
        colorFallbacks.notKeptPrimary,
        colorFallbacks.notKeptSecondary
      ),
    [
      statusGroups.notKept,
      colorFallbacks.notKeptPrimary,
      colorFallbacks.notKeptSecondary,
    ]
  );

  const orderedStatuses = useMemo(() => {
    const statusByLabel = new Map(
      statuses.map((status) => [status.label.toLowerCase(), status])
    );

    const list: HeroStatusSummary[] = [];

    statusOrder.forEach((label) => {
      const status = statusByLabel.get(label.toLowerCase());
      if (status) {
        list.push(status);
      }
    });

    return list;
  }, [statuses, statusOrder]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ProfileDetails
        tagline={tagline}
        name={name}
        position={position}
        promiseLabel={promiseLabel}
        trailText={trailText}
        totalPromises={totalPromises}
        statusInfo={statusInfo}
        isAlternateChart={showRectChart}
        onToggleAlternateChart={() => setShowRectChart((prev) => !prev)}
        isDesktop={isDesktop}
        shareTitle={shareTitle}
      />
      <Box sx={{ flexGrow: 1, width: "100%" }}>
        {isDesktop ? (
          showRectChart ? (
            <RectChart
              totalPromises={totalPromises}
              statuses={orderedStatuses}
            />
          ) : (
            <DesktopChart
              totalPromises={totalPromises}
              chartCaptions={chartCaptions}
              kept={keptWithFallback}
              uncertain={uncertainWithFallback}
              notKept={notKeptWithFallback}
            />
          )
        ) : (
          <MobileChart
            chartCaptions={chartCaptions}
            totalPromises={totalPromises}
            kept={keptWithFallback}
            uncertain={uncertainWithFallback}
            notKept={notKeptWithFallback}
          />
        )}
      </Box>
    </Box>
  );
};

export default ProfileChart;
