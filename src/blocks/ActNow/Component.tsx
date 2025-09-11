"use client";

import { ActNowBlock as ActNowBlockProps, Media } from "@/payload-types";
import { Box, Container, Typography, useMediaQuery } from "@mui/material";
import Grid from "@mui/material/Grid";
import { useTheme } from "@mui/material/styles";
import Image from "next/image";
import { CMSLink } from "@/components/CMSLink";

type MaybeMedia = string | Media | null | undefined;

function getMediaSrc(m: MaybeMedia): { src?: string; alt?: string } {
  if (!m) return {};
  if (typeof m === "string") return { src: undefined, alt: undefined };
  return { src: m.url ?? undefined, alt: m.alt };
}

export default function ActNow({
  logo,
  description,
  image,
  link,
}: ActNowBlockProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const descriptionVariant = isDesktop ? "body1" : "body2";

  const logoMedia = getMediaSrc(logo);
  const heroMedia = getMediaSrc(image);

  return (
    <Box
      sx={{
        bgcolor: "#ebebeb",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pb: 6.625, // ~53px
        pt: 5.625, // ~45px
      }}
    >
      <Container>
        <Grid
          container
          sx={{
            alignItems: { xs: "center", lg: "stretch" },
            justifyContent: { xs: "center", lg: "space-between" },
          }}
        >
          <Grid size={{ xs: 12, lg: 6 }} container alignItems="center">
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: { xs: "center", lg: "flex-start" },
              }}
            >
              {logoMedia.src && (
                <Box
                  component="figure"
                  sx={{
                    m: 0,
                    position: "relative",
                    height: { xs: 105.5, lg: 140.63 },
                    width: { xs: 208.36, lg: 277.74 },
                  }}
                >
                  <Image
                    src={logoMedia.src}
                    alt={logoMedia.alt ?? "actNOW"}
                    fill
                    style={{ objectFit: "contain" }}
                  />
                </Box>
              )}
              <Typography
                variant={descriptionVariant}
                sx={{
                  py: 2,
                  pb: 3,
                  textAlign: "left",
                  lineHeight: { lg: "1.875rem" },
                }}
              >
                {description}
              </Typography>
              {link?.label && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: { xs: "center", lg: "flex-start" },
                  }}
                >
                  <CMSLink
                    label={link.label}
                    type={link.type}
                    reference={link.reference as any}
                    url={link.url}
                    newTab={link.newTab}
                    sx={[
                      (t) => ({
                        border: `1px solid ${t.palette.primary.main}`,
                        minHeight: t.typography.pxToRem(48),
                        minWidth: {
                          xs: t.typography.pxToRem(98),
                          lg: t.typography.pxToRem(158),
                        },
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: t.palette.primary.main,
                        color: t.palette.primary.contrastText,
                        textDecoration: "none",
                        fontWeight: 500,
                        ":hover": {
                          border: `1px solid ${t.palette.primary.main}`,
                          background: t.palette.background.default,
                          color: t.palette.text.primary,
                          textDecoration: "none",
                        },
                      }),
                    ]}
                  />
                </Box>
              )}
            </Box>
          </Grid>
          <Grid>
            {heroMedia.src && (
              <Box
                component="figure"
                sx={{
                  m: 0,
                  position: "relative",
                  height: { xs: 272, lg: 350 },
                  width: { xs: 314, lg: 440 },
                }}
              >
                <Image
                  src={heroMedia.src}
                  alt={heroMedia.alt ?? link?.label ?? "Act Now"}
                  fill
                  style={{ objectFit: "contain" }}
                />
              </Box>
            )}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
