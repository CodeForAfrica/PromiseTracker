import React from "react";
import NextLink from "next/link";
import {
  Box,
  Card,
  CardContent,
  Container,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import type { PoliticalEntity, Tenant } from "@/payload-types";

type PoliticalEntityListProps = {
  tenant: Tenant;
  politicalEntities: PoliticalEntity[];
  pageSlugs?: string[];
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

export const PoliticalEntityList = ({
  tenant,
  politicalEntities,
  pageSlugs = [],
}: PoliticalEntityListProps) => {
  const hasEntities = politicalEntities.length > 0;

  return (
    <Container component="section" sx={{ py: { xs: 4, md: 6 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h2" sx={{ mb: 0.5 }}>
          {tenant.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {hasEntities
            ? "Select a political entity to continue."
            : "No political entities are available for this tenant yet."}
        </Typography>
      </Box>

      {hasEntities && (
        <Card variant="outlined" sx={{ borderRadius: 1 }}>
          <CardContent sx={{ p: 0 }}>
            <List disablePadding dense>
              {politicalEntities.map((entity, index) => {
                const href = buildHref(entity, pageSlugs);

                return (
                  <React.Fragment key={entity.id}>
                    <ListItem disablePadding>
                      <ListItemButton
                        component={NextLink}
                        href={href}
                        sx={{ py: 1.25, px: { xs: 2, md: 2.5 } }}
                      >
                        <ListItemText
                          primary={entity.name}
                          secondary={
                            [entity.position, entity.region]
                              .filter(Boolean)
                              .join(" • ") || undefined
                          }
                          primaryTypographyProps={{
                            variant: "h5",
                            sx: { fontWeight: 600 },
                          }}
                          secondaryTypographyProps={{
                            variant: "body2",
                            color: "primary",
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                    {index < politicalEntities.length - 1 ? (
                      <Divider component="div" />
                    ) : null}
                  </React.Fragment>
                );
              })}
            </List>
          </CardContent>
        </Card>
      )}
    </Container>
  );
};
