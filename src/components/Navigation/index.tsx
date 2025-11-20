"use client";

import React from "react";
import type { ElementType } from "react";
import NextLink from "next/link";
import Image from "next/image";
import {
  AppBar,
  Toolbar,
  Box,
  IconButton,
  Container,
  Grid,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

import type { Logo, MenuLink } from "@/types/navigation";
import Search from "@/components/Search";
import { DesktopMenu } from "@/components/Navigation/DesktopMenu";
import { MobileMenu } from "@/components/Navigation/MobileMenu";

type NavigationProps = {
  primaryLogo: Logo;
  menus: MenuLink[];
  title: string;
  entitySlug?: string;
  tenantSelectionHref?: string;
  showSearch?: boolean;
  tenantFlag?: string | null;
  tenantFlagLabel?: string | null;
  tenantName?: string | null;
};

export default function Navigation({
  primaryLogo,
  menus,
  title,
  entitySlug,
  tenantName,
  showSearch = true,
  tenantFlag,
  tenantFlagLabel,
  tenantSelectionHref,
}: NavigationProps) {
  const theme = useTheme();
  const logoSrc = primaryLogo?.url || null;
  const logoAlt = primaryLogo?.alt || "Logo";
  const globalHomeHref =
    tenantSelectionHref ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "/";
  const logoHref = globalHomeHref;
  const isExternalLogoHref =
    logoHref.startsWith("http://") ||
    logoHref.startsWith("https://") ||
    logoHref.startsWith("//");
  const LogoComponent: ElementType = isExternalLogoHref ? "a" : NextLink;
  const showTenantFlag = Boolean(entitySlug && tenantFlag);
  const flagAltText = tenantFlagLabel
    ? `${tenantFlagLabel} flag`
    : `${title} flag`;
  const tenantHomeHref = "/";
  const entityNameDisplay = tenantName?.toUpperCase() ?? null;

  return (
    <AppBar
      color="primary"
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: theme.palette.background.default,
        boxShadow: {
          xs: "0px 10px 40px #0000002E",
          lg: "0px 8px 30px #0000001A",
        },
      }}
    >
      <Toolbar disableGutters sx={{ display: "block" }}>
        <Box sx={{ py: { xs: 2, lg: 0 } }}>
          <Container>
            <Box sx={{ py: { lg: theme.typography.pxToRem(54) } }}>
              <Grid
                container
                alignItems="center"
                justifyContent="space-between"
              >
                <Grid size={4}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: showTenantFlag ? 1 : 0,
                    }}
                  >
                    <IconButton
                      component={LogoComponent}
                      href={logoHref}
                      disableRipple
                      disableFocusRipple
                      sx={{
                        p: 0,
                        "&:hover": { backgroundColor: "transparent" },
                      }}
                    >
                      <Box
                        sx={{
                          width: {
                            xs: theme.typography.pxToRem(135),
                            lg: theme.typography.pxToRem(236),
                          },
                          display: "inline-flex",
                          alignItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        {logoSrc ? (
                          <Image
                            src={logoSrc}
                            alt={logoAlt}
                            width={236}
                            height={31}
                            style={{ width: "100%", height: "auto" }}
                          />
                        ) : (
                          <Box component="span" sx={{ fontWeight: 700 }}>
                            {title}
                          </Box>
                        )}
                      </Box>
                    </IconButton>
                    {showTenantFlag ? (
                      <Box
                        component={NextLink}
                        href={tenantHomeHref}
                        aria-label={
                          tenantName
                            ? `Go to ${tenantName} page`
                            : tenantFlagLabel
                              ? `Go to ${tenantFlagLabel} page`
                              : "Go to tenant page"
                        }
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          textDecoration: "none",
                          color: "text.primary",
                          gap: 1,
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            fontWeight: 700,
                            fontSize: theme.typography.pxToRem(40),
                            lineHeight: 1,
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          /
                        </Box>
                        <Box
                          component="img"
                          src={tenantFlag as string}
                          alt={flagAltText}
                          loading="lazy"
                          sx={{
                            height: theme.typography.pxToRem(32),
                            width: theme.typography.pxToRem(32),
                            display: "block",
                            borderRadius: "50%",
                            objectFit: "cover",
                            boxShadow: "0px 6px 16px rgba(0,0,0,0.12)",
                          }}
                        />
                        {entityNameDisplay ? (
                          <Box
                            component="span"
                            sx={{
                              ml: 1,
                              fontWeight: 700,
                              fontSize: theme.typography.pxToRem(16),
                              textTransform: "uppercase",
                              color: "text.primary",
                              display: { xs: "none", md: "inline-flex" },
                              alignItems: "center",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {entityNameDisplay}
                          </Box>
                        ) : null}
                      </Box>
                    ) : null}
                  </Box>
                </Grid>
                <DesktopMenu menus={menus} entitySlug={entitySlug} />
                <Grid size={3} sx={{ display: { xs: "none", lg: "flex" } }}>
                  <Box
                    sx={{
                      pl: "1rem",
                      width: "100%",
                      display: "flex",
                      justifyContent: "flex-start",
                    }}
                  >
                    {showSearch && <Search />}
                  </Box>
                </Grid>
                <MobileMenu menus={menus} entitySlug={entitySlug} />
              </Grid>
            </Box>
          </Container>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
