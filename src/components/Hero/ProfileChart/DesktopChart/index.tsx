"use client";

import { Fragment } from "react";
import { Divider } from "@mui/material";
import Grid from "@mui/material/Grid";

import type { HeroChartGroup } from "../..";
import ProgressChart from "./ProgressChart";

type DesktopChartProps = {
  totalPromises: number;
  groups: HeroChartGroup[];
};

export const DesktopChart = ({ totalPromises, groups }: DesktopChartProps) => {
  if (!groups.length) {
    return null;
  }

  return (
    <Grid
      container
      sx={(theme) => ({
        borderRadius: theme.typography.pxToRem(8),
        border: `1px solid ${theme.palette.divider}`,
        p: theme.typography.pxToRem(24),
      })}
      columnSpacing={{ xs: 0, md: 4 }}
      rowSpacing={4}
      alignItems="stretch"
      wrap="nowrap"
    >
      {groups.map((group, index) => (
        <Fragment key={group.title}>
          <Grid size={{ xs: 12, md: 4 }}>
            <ProgressChart
              caption={group.title}
              statuses={group.statuses}
              totalPromises={totalPromises}
            />
          </Grid>
          {index < groups.length - 1 ? (
            <Grid
              size={{ md: "auto" }}
              sx={{
                display: { xs: "none", md: "flex" },
                alignItems: "stretch",
              }}
            >
              <Divider orientation="vertical" flexItem />
            </Grid>
          ) : null}
        </Fragment>
      ))}
    </Grid>
  );
};

export default DesktopChart;
