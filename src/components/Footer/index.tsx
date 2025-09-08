"use client";

import React, { useMemo } from "react";
import NextLink from "next/link";
import Image from "next/image";
import {
  Box,
  Typography,
  IconButton,
  Link as MuiLink,
  Container,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useTheme } from "@mui/material/styles";
import FacebookIcon from "@mui/icons-material/Facebook";
import TwitterIcon from "@mui/icons-material/Twitter";
import InstagramIcon from "@mui/icons-material/Instagram";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import GitHubIcon from "@mui/icons-material/GitHub";
import ChatIcon from "@mui/icons-material/Chat";

import type { Media, Page, SiteSetting } from "@/payload-types";
import { RichText } from "@/components/RichText";

type Props = {
  secondaryLogo: SiteSetting["secondaryLogo"];
  secondaryNavigationList: SiteSetting["secondaryNavigationList"];
  alternateLogo: SiteSetting["alternateLogo"];
  connect: SiteSetting["connect"];
  legal?: SiteSetting["legal"] | null;
  description: SiteSetting["description"];
  title: string;
};

type MenuItem = NonNullable<
  NonNullable<
    NonNullable<
      SiteSetting["secondaryNavigationList"]
    >[number]["secondaryNavigation"]
  >["menus"]
>[number];
type LegalItem = NonNullable<
  NonNullable<SiteSetting["legal"]>["links"]
>[number];

function resolveLink(
  item: MenuItem | LegalItem
): { href: string; label: string } | null {
  const link = (item as any)?.link;
  if (!link) return null;
  const label = link.label as string | undefined;
  if (!label) return null;
  if (link.type === "custom" && link.url) {
    return { href: link.url, label };
  }
  if (link.type === "reference" && link.reference) {
    const value = (
      link.reference as { relationTo: "pages"; value: string | Page }
    ).value;
    if (value && typeof value === "object" && (value as Page).slug) {
      return { href: `/${(value as Page).slug}`, label };
    }
    return { href: "/", label };
  }
  return null;
}

type Platform =
  | "Facebook"
  | "Twitter"
  | "Instagram"
  | "Linkedin"
  | "Github"
  | "Slack";

function SocialIcon({ platform }: { platform: Platform }) {
  switch (platform) {
    case "Facebook":
      return <FacebookIcon />;
    case "Twitter":
      return <TwitterIcon />;
    case "Instagram":
      return <InstagramIcon />;
    case "Linkedin":
      return <LinkedInIcon />;
    case "Github":
      return <GitHubIcon />;
    case "Slack":
    default:
      return <ChatIcon />;
  }
}

export default function Footer({
  secondaryLogo,
  alternateLogo,
  secondaryNavigationList,
  connect,
  legal,
  title,
  description,
}: Props) {
  const theme = useTheme();

  const secondaryLogoSrc = useMemo(() => {
    if (!secondaryLogo) return null;
    if (typeof secondaryLogo === "string") return null;
    return (secondaryLogo as Media).url || null;
  }, [secondaryLogo]);

  const alternateLogoSrc = useMemo(() => {
    if (!alternateLogo) return null;
    if (typeof alternateLogo === "string") return null;
    return (alternateLogo as Media).url || null;
  }, [alternateLogo]);

  const secondaryNavColumns = useMemo(() => {
    const list = (secondaryNavigationList || []) as NonNullable<
      SiteSetting["secondaryNavigationList"]
    >;
    return list
      .map((entry) => {
        const group = entry?.secondaryNavigation;
        const items = ((group?.menus || []) as MenuItem[]).map(resolveLink);
        const links = items.filter((x): x is { href: string; label: string } =>
          Boolean(x)
        );
        return {
          title: group?.titles || null,
          links,
        };
      })
      .filter((col) => col.title || col.links.length > 0);
  }, [secondaryNavigationList]);
  const legalLinks = useMemo(() => {
    const items = (legal?.links || []) as LegalItem[];
    return items
      .map(resolveLink)
      .filter((x): x is { href: string; label: string } => Boolean(x));
  }, [legal]);

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
                  <IconButton
                    key={`m-${l.platform}-${l.url}`}
                    component={NextLink}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      backgroundColor: theme.palette.secondary.main,
                      width: "3rem",
                      height: "3rem",
                      mr: 0.5,
                      borderRadius: 0,
                      color: theme.palette.text.primary,
                    }}
                  >
                    <SocialIcon platform={l.platform as Platform} />
                  </IconButton>
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
                      key={`${index}-${m.href}`}
                      sx={{ mt: 1 }}
                    >
                      <MuiLink
                        component={NextLink}
                        href={m.href}
                        underline="none"
                        color="inherit"
                        sx={{
                          typography: "h6",
                          color: theme.palette.secondary.dark,
                        }}
                      >
                        {m.label}
                      </MuiLink>
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
                    alt={""}
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
                  <IconButton
                    key={`m-${l.platform}-${l.url}`}
                    component={NextLink}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      backgroundColor: theme.palette.secondary.main,
                      width: "3rem",
                      height: "3rem",
                      mr: 0.5,
                      color: theme.palette.text.primary,
                      borderRadius: 0,
                    }}
                  >
                    <SocialIcon platform={l.platform as Platform} />
                  </IconButton>
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
                <Typography
                  variant="button"
                  sx={{
                    color: theme.palette.secondary.dark,
                    textTransform: "uppercase",
                    fontWeight: theme.typography.button,
                  }}
                >
                  &copy; {legal?.copyright || "PromiseTracker"}
                </Typography>
                {legalLinks.length > 0 && (
                  <Grid
                    container
                    sx={{
                      mt: { xs: 1, lg: 0 },
                      rowGap: { xs: 1, lg: 0 },
                      columnGap: 0,
                      justifyContent: { xs: "center", lg: "flex-start" },
                    }}
                  >
                    {legalLinks.map((l, index) => (
                      <Grid
                        key={`${index}-${l.href}`}
                        size={{ xs: 12, lg: "auto" }}
                        sx={{
                          pl: { xs: 0, lg: 3 },
                          textAlign: { xs: "center", lg: "left" },
                        }}
                      >
                        <MuiLink
                          component={NextLink}
                          href={l.href}
                          underline="none"
                          color={theme.palette.secondary.dark}
                          sx={{
                            typography: "button",
                            textTransform: "uppercase",
                            fontWeight: theme.typography.button,
                            display: "inline-block",
                            color: theme.palette.secondary.dark,
                          }}
                        >
                          {l.label}
                        </MuiLink>
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
              {connect?.links?.map((l) => (
                <IconButton
                  key={`${l.platform}-${l.url}`}
                  component={NextLink}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    backgroundColor: theme.palette.secondary.main,
                    width: "3rem",
                    height: "3rem",
                    mr: 0.5,
                    color: theme.palette.text.primary,
                  }}
                >
                  <SocialIcon platform={l.platform as Platform} />
                </IconButton>
              ))}
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}
