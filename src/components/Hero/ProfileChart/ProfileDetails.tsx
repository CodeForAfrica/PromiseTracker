"use client";

import { useMemo } from "react";
import BarChartIcon from "@mui/icons-material/BarChart";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical";

import { RichText } from "@/components/RichText";
import type { HeroInfoItem } from "../index";
import Share from "@/components/Share";
import MobileInfoStatusPopover from "./MobileInfoStatusPopover";
import DesktopInfoStatusPopover from "./DesktopInfoStatusPopover";

type ProfileDetailsProps = {
  tagline?: DefaultTypedEditorState | null;
  name: string;
  position: string;
  promiseLabel: string;
  trailText?: string | null;
  totalPromises: number;
  statusInfo: {
    title?: string;
    items: HeroInfoItem[];
  };
  isAlternateChart: boolean;
  onToggleAlternateChart: () => void;
  isDesktop: boolean;
  shareTitle: string;
};

const buildSummary = (
  position: string,
  name: string,
  totalPromises: number,
  promiseLabel: string,
  trailText?: string | null
) => {
  const pieces = [
    `${position} ${name}`.trim(),
    totalPromises > 0 ? `${totalPromises} ${promiseLabel}`.trim() : undefined,
    trailText?.trim(),
  ].filter(Boolean);

  return pieces.join(" ");
};

const HIGHLIGHT_CLASS_SX = {
  "& .highlight": {
    color: "info.main",
  },
};

export const ProfileDetails = ({
  tagline,
  name,
  position,
  promiseLabel,
  trailText,
  totalPromises,
  statusInfo,
  isAlternateChart,
  onToggleAlternateChart,
  isDesktop,
  shareTitle,
}: ProfileDetailsProps) => {
  const InfoPopover = isDesktop
    ? DesktopInfoStatusPopover
    : MobileInfoStatusPopover;

  const summary = useMemo(
    () => buildSummary(position, name, totalPromises, promiseLabel, trailText),
    [name, position, promiseLabel, totalPromises, trailText]
  );

  return (
    <Stack spacing={2} sx={{ mb: { xs: 2, lg: 3 } }}>
      {isDesktop && tagline ? (
        <RichText
          data={tagline}
          component="h1"
          sx={(theme) => ({
            ...HIGHLIGHT_CLASS_SX,
            color: theme.palette.primary.dark,
            typography: theme.typography.h1,
          })}
        />
      ) : null}

      <Box
        sx={(theme) => ({
          alignItems: "center",
          display: "flex",
          flexDirection: { xs: "row", lg: "row" },
          gap: theme.typography.pxToRem(12),
          justifyContent: "space-between",
          flexWrap: "wrap",
        })}
      >
        <Box sx={{ flexGrow: 1, minWidth: { xs: "100%", lg: "60%" } }}>
          <Typography variant="body2" sx={{ color: "text.primary" }}>
            {summary}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {isDesktop ? (
            <IconButton
              aria-label={
                isAlternateChart
                  ? "Show circle charts"
                  : "Show comparison chart"
              }
              size="small"
              onClick={onToggleAlternateChart}
              sx={(theme) => ({
                backgroundColor: theme.palette.secondary.light,
                width: theme.typography.pxToRem(40),
                height: theme.typography.pxToRem(40),
                "&:hover": {
                  backgroundColor: theme.palette.secondary.main,
                },
              })}
            >
              {isAlternateChart ? (
                <DonutLargeIcon fontSize="small" />
              ) : (
                <BarChartIcon fontSize="small" />
              )}
            </IconButton>
          ) : null}
          <InfoPopover title={statusInfo.title} items={statusInfo.items} />
          <Share
            title={shareTitle}
            iconButtonProps={{
              sx: (theme) => ({
                backgroundColor: theme.palette.secondary.light,
                width: theme.typography.pxToRem(40),
                height: theme.typography.pxToRem(40),
                "&:hover": {
                  backgroundColor: theme.palette.secondary.main,
                },
              }),
            }}
          />
        </Stack>
      </Box>
    </Stack>
  );
};

export default ProfileDetails;
