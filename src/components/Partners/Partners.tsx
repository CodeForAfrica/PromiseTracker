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
          variant="h2"
          sx={{
            textAlign: { xs: "center", lg: "left" },
            textTransform: "capitalize",
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
              rowSpacing={{ xs: 4, md: 5 }}
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
                  <CMSLink {...partner.url} label={""} entitySlug={entitySlug}>
                    <Box
                      sx={{
                        width: "100%",
                        maxWidth: { xs: 260, sm: 320, lg: 280 },
                        aspectRatio: "3 / 2",
                        position: "relative",
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
