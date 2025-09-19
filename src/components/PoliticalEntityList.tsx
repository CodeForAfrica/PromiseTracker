import React from "react";
import NextLink from "next/link";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  Stack,
  Typography,
} from "@mui/material";
import type { PoliticalEntity, Tenant } from "@/payload-types";
import { getGlobalPayload } from "@/lib/payload";
import { resolveMedia } from "@/lib/data/media";

type PoliticalEntityListProps = {
  tenant: Tenant;
  politicalEntities: PoliticalEntity[];
  pageSlugs?: string[];
  extractionCounts?: Record<string, number>;
};

const buildHref = (entity: PoliticalEntity, pageSlugs: string[] = []) => {
  const sanitizedPageSlugs = pageSlugs.filter(
    (slug) => slug && slug !== "index"
  );
  const segments = [entity.slug, ...sanitizedPageSlugs].filter(Boolean);

  if (segments.length === 0) {
    return "/";
  }

  return `/${segments.join("/")}`;
};

export const PoliticalEntityList = async ({
  politicalEntities,
  pageSlugs = [],
  extractionCounts = {},
}: PoliticalEntityListProps) => {
  const payload = await getGlobalPayload();

  const { entitySelector } = await payload.findGlobal({
    slug: "home-page",
  });

  if (!politicalEntities.length) {
    return (
      <Container component="section" sx={{ py: { xs: 6, md: 8 } }}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {entitySelector.emptyTitle}
            </Typography>
            <Typography variant="body2">
              {entitySelector.EmptySubtitle}
            </Typography>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container component="section" sx={{ py: { xs: 6, md: 8 } }}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <List disablePadding sx={{ "& > * + *": { mt: 1 } }}>
            {politicalEntities.map(async (entity, index) => {
              const href = buildHref(entity, pageSlugs);
              const media = await resolveMedia(entity.image);
              const extractionCount = extractionCounts[entity.id] ?? 0;
              const initials = entity.name
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("");

              return (
                <React.Fragment key={entity.id}>
                  <ListItem disableGutters sx={{ alignItems: "stretch" }}>
                    <ListItemButton
                      component={NextLink}
                      href={href}
                      sx={{
                        borderRadius: 2,
                        "&:hover": {
                          backgroundColor: "action.hover",
                        },
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={2}
                        alignItems="center"
                        sx={{ width: "100%" }}
                      >
                        <ListItemAvatar sx={{ minWidth: "auto" }}>
                          <Avatar
                            src={media?.url ?? undefined}
                            alt={media?.alt ?? entity.name}
                            sx={{ width: 56, height: 56 }}
                          >
                            {initials || "?"}
                          </Avatar>
                        </ListItemAvatar>
                        <Box flexGrow={1} minWidth={0}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 600,
                              textTransform: "uppercase",
                            }}
                          >
                            {entity.position}
                          </Typography>
                          <Typography
                            variant="h6"
                            sx={{ fontWeight: 700, lineHeight: 1.2, mt: 0.5 }}
                          >
                            {entity.name}
                          </Typography>
                          {entity.region ? (
                            <Typography variant="body2">
                              {entity.region}
                            </Typography>
                          ) : null}
                        </Box>
                        <Chip
                          label={`${extractionCount} promise${extractionCount === 1 ? "" : "s"}`}
                          color={extractionCount > 0 ? "primary" : "default"}
                          variant={extractionCount > 0 ? "filled" : "outlined"}
                        />
                      </Stack>
                    </ListItemButton>
                  </ListItem>
                  {index < politicalEntities.length - 1 ? (
                    <Box
                      component="hr"
                      sx={{
                        border: 0,
                        borderBottom: 1,
                        borderColor: "divider",
                        my: 1,
                      }}
                    />
                  ) : null}
                </React.Fragment>
              );
            })}
          </List>
        </CardContent>
      </Card>
    </Container>
  );
};
