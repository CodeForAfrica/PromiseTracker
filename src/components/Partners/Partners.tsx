"use client";
import { Grid, Container, Box, Typography } from "@mui/material";

import Image from "next/image";
import { CMSLink } from "@/components/CMSLink";
import React from "react";
import type { Partner as PartnerType } from "@/payload-types";

interface Props {
  partners: Array<{
    name: string;
    url: PartnerType["url"];
    image: {
      url: string;
      alt?: string;
    };
  }>;
  title: string;
  entitySlug?: string;
}
const Partners = React.forwardRef<HTMLDivElement, Props>(function Partners(
  { partners, title, entitySlug },
  ref,
) {
  if (!partners?.length) {
    return null;
  }
  return (
    <Box
      sx={({ palette }) => ({
        backgroundColor: palette.secondary.light,
      })}
      component={"section"}
    >
      <Container
        sx={{ py: 8, textAlign: { xs: "center", lg: "left" } }}
        ref={ref}
      >
        <Typography
          component="h2"
          variant="h4"
          sx={{
            width: "100%",
            margin: 0,
            textAlign: { xs: "center", lg: "left" },
            textTransform: "uppercase",
            fontWeight: 600,
            letterSpacing: "0.64px",
          }}
        >
          {title}
        </Typography>
        <Grid container justifyContent="center">
          <Grid size={{ xs: 12, lg: 10 }}>
            <Grid
              container
              justifyContent={{
                xs: "center",
                lg: "space-between",
              }}
              rowSpacing={{ xs: 4, md: 5, lg: 0 }}
              columnSpacing={{ lg: 4 }}
            >
              {partners.slice(0, 6).map((partner) => (
                <Grid
                  key={partner.name}
                  size={{
                    xs: 12,
                    lg: 4,
                  }}
                >
                  <CMSLink
                    {...partner.url}
                    label={""}
                    entitySlug={entitySlug}
                    sx={{
                      display: "block",
                      margin: 0,
                      width: { lg: "16.25rem" },
                      height: { lg: "7.5rem" },
                    }}
                  >
                    <Box
                      sx={{
                        width: "100%",
                        maxWidth: { xs: 260, sm: 320, lg: 280 },
                        aspectRatio: "3 / 2",
                        position: "relative",
                        m: 0,
                        mx: "auto",
                      }}
                      component={"figure"}
                    >
                      {partner.image && (
                        <Image
                          src={partner.image?.url}
                          alt={partner.name}
                          fill
                          style={{ objectFit: "contain" }}
                          sizes="(min-width: 1200px) 280px, (min-width: 900px) 320px, 260px"
                        />
                      )}
                    </Box>
                  </CMSLink>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
});

export default Partners;
