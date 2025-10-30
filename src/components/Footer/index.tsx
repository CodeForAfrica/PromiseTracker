"use client";

import React from "react";
import Image from "next/image";
import { Box, Typography, Container } from "@mui/material";
import Grid from "@mui/material/Grid";
import { useTheme } from "@mui/material/styles";
import { SocialMediaIconLink } from "@/components/SocialMediaIconLink";

import type { SiteSetting } from "@/payload-types";
import { RichText } from "@/components/RichText";
import { CMSLink } from "@/components/CMSLink";
import type { Logo, LegalLinks, SecondaryNavColumn } from "@/types/navigation";
import CcIcon from "@/assets/cc.svg?url";

type Props = {
  secondaryLogo: Logo;
  secondaryNavColumns: SecondaryNavColumn[];
  alternateLogo: Logo;
  connect: SiteSetting["connect"];
  legal: LegalLinks;
  description: SiteSetting["description"];
  title: string;
  entitySlug?: string;
};

export default function Footer({
  secondaryLogo,
  alternateLogo,
  secondaryNavColumns,
  connect,
  legal,
  title,
  description,
  entitySlug,
}: Props) {
  const theme = useTheme();
  const secondaryLogoSrc = secondaryLogo?.url || null;
  const alternateLogoSrc = alternateLogo?.url || null;

  return (
    <Box component="footer">
      <Box
        sx={{
          backgroundColor: theme.palette.secondary.light,
          pt: {
            xs: theme.typography.pxToRem(50),
            lg: theme.typography.pxToRem(56.44),
          },
          pb: theme.typography.pxToRem(50),
        }}
      >
        <Container>
          <Grid container spacing={2}>
            <Grid
              size={12}
              display="flex"
              justifyContent={{ xs: "center", md: "flex-start" }}
            >
              <Box
                sx={{
                  position: "relative",
                  width: theme.typography.pxToRem(189.59),
                  height: theme.typography.pxToRem(107.85),
                }}
              >
                {secondaryLogoSrc ? (
                  <Image
                    src={secondaryLogoSrc}
                    alt={""}
                    fill
                    style={{ objectFit: "contain" }}
                  />
                ) : (
                  <Box sx={{ fontWeight: 700 }}>PromiseTracker</Box>
                )}
              </Box>
              <Box
                display={{ xs: "flex", lg: "none" }}
                alignItems="center"
                justifyContent="center"
                gap={1}
                sx={{ mt: 2, flexWrap: "wrap" }}
              >
                {connect?.links?.map((l) => (
                  <SocialMediaIconLink
                    key={`m-${l.platform}-${l.url}`}
                    platform={l.platform}
                    href={l.url}
                    sx={{
                      backgroundColor: theme.palette.secondary.main,
                      width: "3rem",
                      height: "3rem",
                      mr: 0.5,
                      borderRadius: 0,
                      color: theme.palette.text.primary,
                    }}
                  />
                ))}
              </Box>
            </Grid>

            <Grid size={{ xs: 12, lg: 8 }}>
              <RichText
                data={description}
                sx={(theme) => ({
                  ...theme.typography.body2,
                  mt: 3,
                })}
              />
            </Grid>

            {/* Secondary navigation columns (optional) */}
            {secondaryNavColumns.map((col, idx) => (
              <Grid
                key={idx}
                size={{ xs: 6, lg: idx === 0 ? 2 : 1 }}
                offset={idx === 0 ? { lg: 1 } : undefined}
                sx={{ mt: { xs: 4, lg: 0 } }}
              >
                {col.title ? (
                  <Typography variant="h3" sx={{ mb: 1, color: "black" }}>
                    {col.title}
                  </Typography>
                ) : null}
                <Box component="ul" sx={{ listStyle: "none", pl: 0, m: 0 }}>
                  {col.links.map((m, index) => (
                    <Box
                      component="li"
                      key={`${index}-${m.label}`}
                      sx={{ mt: 1 }}
                    >
                      <CMSLink
                        {...m}
                        entitySlug={entitySlug}
                        sx={{
                          typography: "h6",
                          color: theme.palette.secondary.dark,
                          textDecoration: "none",
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box
        sx={{
          backgroundColor: theme.palette.primary.dark,
          color: theme.palette.secondary.dark,
          py: "3rem",
        }}
      >
        <Container
          sx={({ typography }) => ({
            padding: {
              xs: `0 ${typography.pxToRem(23)}`,
              lg: 0,
            },
            margin: {
              xs: 0,
              lg: "0 auto",
            },
          })}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid
              size={{ xs: 12, lg: 6 }}
              display="flex"
              alignItems={{ xs: "center", lg: "flex-start" }}
              justifyContent={{ xs: "center", lg: "flex-start" }}
              sx={{ flexDirection: "column" }}
              gap={2}
            >
              <Box
                sx={{
                  position: "relative",
                  width: theme.typography.pxToRem(235),
                  height: theme.typography.pxToRem(70),
                  mb: { xs: 1, lg: 0 },
                }}
              >
                {alternateLogoSrc ? (
                  <Image
                    src={alternateLogoSrc}
                    alt={alternateLogo?.alt}
                    fill
                    style={{ objectFit: "contain" }}
                  />
                ) : (
                  <Box sx={{ fontWeight: 700 }}>{title}</Box>
                )}
              </Box>

              <Typography
                variant="button"
                sx={{
                  display: { xs: "block", lg: "none" },
                  textTransform: "uppercase",
                  color: theme.palette.secondary.dark,
                  textAlign: "center",
                  mt: 2,
                  mb: 1,
                  fontWeight: theme.typography.button,
                }}
              >
                {connect.title}
              </Typography>

              <Box
                sx={{
                  display: { xs: "flex", lg: "none" },
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  mt: 0,
                  flexWrap: "wrap",
                }}
              >
                {connect?.links?.map((l) => (
                  <SocialMediaIconLink
                    key={`m-${l.platform}-${l.url}`}
                    platform={l.platform}
                    href={l.url}
                    sx={{
                      backgroundColor: theme.palette.secondary.main,
                      width: "3rem",
                      height: "3rem",
                      mr: 0.5,
                      color: theme.palette.text.primary,
                      borderRadius: 0,
                    }}
                  />
                ))}
              </Box>

              <Box
                display="flex"
                alignItems={{ xs: "center", lg: "flex-start" }}
                gap={1}
                flexWrap="wrap"
                justifyContent={{ xs: "center", lg: "flex-start" }}
                sx={{
                  width: "100%",
                  flexDirection: { xs: "column", lg: "row" },
                }}
              >
                <Box
                  sx={(theme) => ({
                    display: "inline-flex",
                    alignItems: "center",
                    gap: theme.typography.pxToRem(11),
                    color: "#a4a4a4",
                  })}
                >
                  <Image
                    src={CcIcon}
                    alt="Creative Commons"
                    width={19}
                    height={19}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: "inherit",
                      textTransform: "uppercase",
                      fontWeight: theme.typography.button,
                    }}
                  >
                    {legal?.copyright}
                  </Typography>
                </Box>
                {legal.links.length > 0 && (
                  <Grid
                    container
                    sx={{
                      mt: { xs: 1, lg: 0 },
                      rowGap: { xs: 1, lg: 0 },
                      columnGap: 0,
                      justifyContent: { xs: "center", lg: "flex-start" },
                    }}
                  >
                    {legal.links.map((l, index) => (
                      <Grid
                        key={`${index}-${l.label}`}
                        size={{ xs: 12, lg: "auto" }}
                        sx={{
                          pl: { xs: 0, lg: 3 },
                          textAlign: { xs: "center", lg: "left" },
                        }}
                      >
                        <CMSLink
                          {...l}
                          entitySlug={entitySlug}
                          sx={{
                            typography: "button",
                            textTransform: "uppercase",
                            fontWeight: theme.typography.button,
                            display: "inline-block",
                            color: theme.palette.secondary.dark,
                            textDecoration: "none",
                          }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Box>
            </Grid>

            <Grid
              size={{ xs: 12, lg: 6 }}
              display={{ xs: "none", lg: "flex" }}
              justifyContent={{ lg: "flex-end" }}
              alignItems="center"
              gap={1}
            >
              {connect?.links && connect.links.length > 0 && (
                <Typography
                  variant="button"
                  sx={{
                    textTransform: "uppercase",
                    color: theme.palette.secondary.dark,
                    mr: 2,
                    fontWeight: theme.typography.button,
                  }}
                >
                  {connect.title}
                </Typography>
              )}

              {connect?.links?.map((l) => (
                <SocialMediaIconLink
                  key={`${l.platform}-${l.url}`}
                  platform={l.platform}
                  href={l.url}
                  sx={{
                    backgroundColor: theme.palette.secondary.main,
                    width: "3rem",
                    height: "3rem",
                    mr: 0.5,
                    color: theme.palette.text.primary,
                  }}
                />
              ))}
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}
