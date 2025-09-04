"use client";
import Section from "@/components/Section";
import Link from "@/components/Link";
import { Grid2 as Grid, Button, Box, Typography, Stack } from "@mui/material";
import Figure from "@/components/Figure";
import React from "react";

import Copyright from "./Copyright";
import Logo from "./Logo";

import ptLogo from "@/assets/footer-pt-logo.png";
import cfaLogo from "@/assets/logo-C4A.svg?url";
import SocialMediaIconLink from "@/components/SocialMediaIconLink";

function MainFooter({
  about,
  copyright,
  legalLinks: legalLinksProp,
  organizationLogo: organizationLogoProp,
  quickLinks: quickLinksProp,
  description,
  socialMedia,
  ...otherProps
}) {
  const organizationLogo = {
    image: {
      src: organizationLogoProp?.image || cfaLogo,
      alt: organizationLogoProp?.alt || "Code for Africa",
    },
    url: organizationLogoProp?.link || "https://codeforafrica.org",
  };
  const linkify = (props) => {
    return {
      ...props,
      component: Link,
    };
  };
  const primaryLinks = quickLinksProp?.primary?.links.map(linkify);

  const secondaryLinks = quickLinksProp?.secondary?.links.map(linkify);

  return (
    <Box sx={{}}>
      <Box
        sx={(theme) => ({
          background: theme.palette.background.default,
          pt: {
            xs: 50 / 8,
            lg: 56.44 / 8,
          },
          pb: 6.25,
        })}
      >
        <Section
          sx={{
            padding: { xs: "0 23px", lg: 0 },
            margin: { xs: 0, lg: "0 auto" },
            width: "100%",
          }}
        >
          <Grid container spacing={4}>
            <Grid
              size={{ xs: 12, md: 12 }}
              sx={{
                display: "flex",
                justifyContent: { xs: "center", md: "flex-start" },
                width: "100%",
              }}
            >
              <Logo {...organizationLogo} />
            </Grid>
            <Grid item size={{ xs: 12, lg: 8 }}>
              <Typography variant="body2">{description}</Typography>
            </Grid>

            {primaryLinks?.length > 0 && (
              <Grid
                item
                size={{ xs: 6, lg: 3 }}
                sx={{
                  pl: { xs: 0, lg: 4 },
                }}
              >
                <Box sx={{}}>
                  <Typography sx={{ mb: 4 }} variant="h3">
                    {quickLinksProp?.primary?.title}
                  </Typography>
                  <Box display={"flex"} flexDirection="column">
                    {primaryLinks.map((link) => (
                      <Button
                        component={Link}
                        key={link.href}
                        sx={{
                          color: "inherit",
                          textTransform: "uppercase",
                          backgroundColor: "transparent",
                          border: "none",

                          justifyContent: "flex-start",
                          padding: 0,
                          mb: 2,
                          color: "#a4a4a4",
                          "&:hover": {
                            backgroundColor: "transparent",
                            textDecoration: "underline",
                          },
                        }}
                        {...link}
                      >
                        {link.label}
                      </Button>
                    ))}
                  </Box>
                </Box>
              </Grid>
            )}
            {secondaryLinks?.length > 0 && (
              <Grid item size={{ xs: 6, lg: 1 }}>
                <Box>
                  <Typography sx={{ mb: 4 }} variant="h3">
                    {quickLinksProp?.secondary?.title}
                  </Typography>
                  <Box display={"flex"} flexDirection="column">
                    {secondaryLinks.map((link) => (
                      <Button
                        component={Link}
                        key={link.href}
                        sx={{
                          color: "inherit",
                          textTransform: "uppercase",
                          backgroundColor: "transparent",
                          border: "none",

                          justifyContent: "flex-start",
                          padding: 0,
                          mb: 2,
                          color: "#a4a4a4",
                          "&:hover": {
                            backgroundColor: "transparent",
                            textDecoration: "underline",
                          },
                        }}
                        {...link}
                      >
                        {link.label}
                      </Button>
                    ))}
                  </Box>
                </Box>
              </Grid>
            )}
          </Grid>
        </Section>
      </Box>
      <Box
        sx={({ palette }) => ({
          backgroundColor: palette.primary.dark,
          color: palette.secondary.dark,
          padding: "3rem 0rem",
        })}
      >
        <Section
          sx={{
            padding: { xs: "0 23px", lg: 0 },
            margin: { xs: 0, lg: "0 auto" },
            width: "100%",
          }}
        >
          <Grid container>
            <Grid
              size={{
                xs: 12,
                lg: 6,
              }}
              display="flex"
              alignItems={{ xs: "center", lg: "flex-start" }}
              justifyContent="center"
              flexDirection={"column"}
            >
              <Figure
                ImageProps={{
                  alt: "PromiseTracker",
                  src: ptLogo,
                }}
                sx={{ width: "235px", height: "70px" }}
              />
              <Box>
                <Copyright {...copyright} menu={legalLinksProp}></Copyright>
              </Box>
            </Grid>
            <Grid
              item
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                flexDirection: { xs: "column", lg: "row" },
              }}
              gap={2}
              size={{ xs: 12, lg: 6 }}
            >
              <Typography
                sx={{
                  color: "#a4a4a4",
                }}
                variant="button"
              >
                {socialMedia?.title}
              </Typography>
              <Stack
                direction="row"
                sx={{
                  alignItems: "center",
                }}
                gap={0.5}
              >
                {socialMedia?.links?.map(({ href, ...others }) => {
                  return (
                    <SocialMediaIconLink {...others} href={href} key={href} />
                  );
                })}
              </Stack>
            </Grid>
          </Grid>
        </Section>
      </Box>
    </Box>
  );
}

export default MainFooter;
