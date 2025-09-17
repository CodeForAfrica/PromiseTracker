"use client";

import { Box, Container, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";

import type { HeroResolvedData } from "./index";
import Profile from "./Profile";
import ProfileChart from "./ProfileChart";

export type HeroClientProps = {
  data: HeroResolvedData;
};

export const HeroClient = ({ data }: HeroClientProps) => {
  const { entity, copy, metrics, headline } = data;

  const shareTitle = [
    headline,
    metrics.total > 0 ? `${metrics.total} ${copy.promiseLabel}` : undefined,
    copy.trailText,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Box
      component="section"
      sx={(theme) => ({
        backgroundColor: "transparent",
        pt: {
          xs: theme.typography.pxToRem(22),
          lg: theme.typography.pxToRem(80),
        },
        pb: {
          xs: theme.typography.pxToRem(40),
          lg: theme.typography.pxToRem(44),
        },
      })}
    >
      <Container maxWidth="lg">
        {headline ? (
          <Typography
            component="h1"
            variant="h1"
            sx={(theme) => ({
              display: { xs: "block", lg: "none" },
              color: theme.palette.primary.dark,
              mb: theme.typography.pxToRem(24),
            })}
          >
            {headline}
          </Typography>
        ) : null}
        <Grid
          container
          rowSpacing={{ xs: 3, lg: 6 }}
          columnSpacing={{ xs: 3, lg: 6 }}
          alignItems="stretch"
        >
          <Grid size={{ xs: 12, lg: 4 }}>
            <Profile
              name={entity.name}
              profileTitle={copy.profileTitle}
              updatedAtLabel={copy.updatedAtLabel}
              updatedAtDisplay={entity.updatedAtDisplay}
              image={entity.image}
            />
          </Grid>
          <Grid size={{ xs: 12, lg: 8 }}>
            <ProfileChart
              headline={headline}
              promiseLabel={copy.promiseLabel}
              trailText={copy.trailText}
              name={entity.name}
              position={entity.position}
              totalPromises={metrics.total}
              statusListTitle={copy.statusListTitle}
              statuses={metrics.statuses}
              groups={metrics.groups}
              shareTitle={shareTitle}
            />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default HeroClient;
