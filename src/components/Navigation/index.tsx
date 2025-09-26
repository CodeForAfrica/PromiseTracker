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
};

export default function Navigation({
  primaryLogo,
  menus,
  title,
  entitySlug,
  tenantSelectionHref,
}: NavigationProps) {
  const theme = useTheme();
  const logoSrc = primaryLogo?.url || null;
  const logoAlt = primaryLogo?.alt || "Logo";
  const logoHref = tenantSelectionHref ?? (entitySlug ? `/${entitySlug}` : "/");
  const isExternalLogoHref =
    logoHref.startsWith("http://") ||
    logoHref.startsWith("https://") ||
    logoHref.startsWith("//");
  const LogoComponent: ElementType = isExternalLogoHref ? "a" : NextLink;

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
                  <IconButton
                    component={LogoComponent}
                    href={logoHref}
                    disableRipple
                    disableFocusRipple
                    sx={{
                      p: 0,
                      "&:hover": { backgroundColor: "transparent" },
                      width: {
                        xs: theme.typography.pxToRem(135),
                        lg: theme.typography.pxToRem(236),
                      },
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
                  </IconButton>
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
                    <Search />
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
