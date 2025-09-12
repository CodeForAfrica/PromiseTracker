"use client";
import { Grid, Container, Box, Typography } from "@mui/material";

import Image from "next/image";
import { CMSLink } from "@/components/CMSLink";
import React from "react";
import { UrlObject } from "url";

interface Props {
  partners: Array<{
    name: string;
    url: UrlObject;
    image: {
      url: string;
      alt?: string;
    };
  }>;
  title: string;
}
const Partners = React.forwardRef<HTMLDivElement, Props>(function Partners(
  { partners, title },
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
      <Container sx={{ py: 8 }} ref={ref}>
        <Typography variant="h4">{title}</Typography>
        <Grid container justifyContent="center">
          <Grid size={{ xs: 12, lg: 10 }}>
            <Grid
              container
              justifyContent={{
                xs: "center",
                lg: "space-between",
              }}
            >
              {partners.slice(0, 6).map(
                (partner: {
                  name: string;
                  url: UrlObject;
                  image: {
                    url: string;
                    alt?: string;
                  };
                }) => (
                  <Grid
                    key={partner.name}
                    size={{
                      xs: 12,
                      lg: "auto",
                    }}
                  >
                    <CMSLink {...partner.url} label={""}>
                      <Box
                        sx={{
                          height: { xs: 126.56, lg: 120 },
                          width: { xs: 273.6, lg: 260 },
                          position: "relative",
                        }}
                        component={"figure"}
                      >
                        {partner.image && (
                          <Image
                            src={partner.image?.url}
                            alt={partner.name}
                            fill
                          />
                        )}
                      </Box>
                    </CMSLink>
                  </Grid>
                ),
              )}
            </Grid>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
});

export default Partners;
