"use client";

import Image from "next/image";
import { Box, Container, Grid, Typography } from "@mui/material";
import type { Theme } from "@mui/material/styles";

import { CMSLink } from "@/components/CMSLink";
import { RichText } from "@/components/RichText";
import type { Partner } from "@/payload-types";

export type PartnerDetailsClientPartner = {
  id: string;
  name: Partner["name"];
  description: Partner["description"];
  url: Partner["url"];
  image: {
    url: string;
    alt: string | null;
  };
};

export type PartnerDetailsClientProps = {
  partners: PartnerDetailsClientPartner[];
  entitySlug?: string;
};

export const PartnerDetailsClient = ({ partners, entitySlug }: PartnerDetailsClientProps) => {
  if (!partners.length) {
    return null;
  }

  return (
    <Box
      component="section"
      sx={{
        marginBottom: {
          xs: "3.25rem",
          lg: "4.75rem",
        },
      }}
    >
      <Container>
        <Grid container>
          {partners.map(({ id, name, description, url, image }, index) => (
            <Grid
              key={id}
              size={{ xs: 12 }}
              sx={index === 0 ? undefined : { paddingTop: "4.75rem" }}
            >
              <CMSLink
                {...url}
                entitySlug={entitySlug}
                label=""
                sx={{
                  display: "block",
                  textDecoration: "none",
                  color: "inherit",
                  "&:hover": {
                    textDecoration: "none",
                  },
                }}
              >
                <Grid container columnSpacing={{ lg: 6 }} rowSpacing={{ xs: 3, lg: 0 }}>
                  <Grid size={{ xs: 12, lg: 7 }}>
                    <Typography
                      variant="h4"
                      sx={(theme: Theme) => ({
                        textTransform: "uppercase",
                        fontSize: theme.typography.pxToRem(18),
                        lineHeight: 24 / 18,
                        marginBottom: theme.typography.pxToRem(16),
                      })}
                    >
                      {name}
                    </Typography>
                    <RichText
                      data={description}
                      sx={(theme: Theme) => ({
                        ...theme.typography.body2,
                        "& p": {
                          ...theme.typography.body2,
                          marginBottom: theme.typography.pxToRem(16),
                          textAlign: "left",
                        },
                        "& ul, & ol": {
                          ...theme.typography.body2,
                          marginBottom: theme.typography.pxToRem(16),
                        },
                      })}
                    />
                  </Grid>
                  <Grid
                    size={{ xs: 12, lg: 5 }}
                    display="flex"
                    justifyContent={{ xs: "center", lg: "flex-end" }}
                  >
                    <Box
                      component="figure"
                      sx={{
                        height: { xs: "12.5rem", lg: "13.75rem" },
                        width: { xs: "16.25rem", lg: "20rem" },
                        position: "relative",
                        margin: 0,
                      }}
                    >
                      <Image
                        src={image.url}
                        alt={image.alt || name}
                        fill
                        sizes="(max-width: 1200px) 320px, 320px"
                        style={{ objectFit: "contain" }}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </CMSLink>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default PartnerDetailsClient;
