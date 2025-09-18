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
import type { Media, PoliticalEntity, Tenant } from "@/payload-types";

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

const resolveImage = (image: PoliticalEntity["image"]): Media | null => {
  if (!image || typeof image === "string") return null;
  return image as Media;
};

export const PoliticalEntityList = ({
  tenant,
  politicalEntities,
  pageSlugs = [],
  extractionCounts = {},
}: PoliticalEntityListProps) => {
  const hasEntities = politicalEntities.length > 0;

  return (
    <Container component="section" sx={{ py: { xs: 6, md: 8 } }}>
      <Stack spacing={2} sx={{ mb: { xs: 4, md: 5 } }}>
        <Typography variant="body1">
          {hasEntities
            ? "Choose a political entity to explore their campaign promises."
            : "No political entities are available for this tenant yet."}
        </Typography>
      </Stack>

      {hasEntities ? (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <List disablePadding sx={{ "& > * + *": { mt: 1 } }}>
              {politicalEntities.map((entity, index) => {
                const href = buildHref(entity, pageSlugs);
                const media = resolveImage(entity.image);
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
                            variant={
                              extractionCount > 0 ? "filled" : "outlined"
                            }
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
      ) : (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              No political entities have been published yet
            </Typography>
            <Typography variant="body2">
              Check back soon for newly tracked leaders and their promises.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Container>
  );
};
