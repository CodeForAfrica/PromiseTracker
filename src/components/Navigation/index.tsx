"use client";

import React, { useMemo, useState } from "react";
import NextLink from "next/link";
import Image from "next/image";
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Grid,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

import type { SiteSetting, Page, Media } from "@/payload-types";
import Search from "@/components/Search";
import Section from "@/components/Section";

type NavigationProps = {
  primaryLogo: SiteSetting["primaryLogo"];
  primaryNavigation?: SiteSetting["primaryNavigation"] | null;
};

type NavMenus = NonNullable<
  NonNullable<SiteSetting["primaryNavigation"]>["menus"]
>;
type NavMenuItem = NavMenus[number];

function getHrefFromLink(
  menu: NavMenuItem
): { href: string; label: string } | null {
  const link = menu?.link;
  if (!link) return null;
  const label = link.label as string | undefined;

  if (link.type === "custom" && link.url && label) {
    return { href: link.url, label };
  }

  if (link.type === "reference" && link.reference && label) {
    const value = (
      link.reference as { relationTo: "pages"; value: string | Page }
    ).value;
    if (
      value &&
      typeof value === "object" &&
      "slug" in value &&
      (value as Page).slug
    ) {
      return { href: `/${(value as Page).slug}`, label };
    }
    return { href: "/", label };
  }

  return null;
}

export default function Navigation({
  primaryLogo,
  primaryNavigation,
}: NavigationProps) {
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const menus = useMemo(() => {
    const items = (primaryNavigation?.menus || []) as NavMenus | [];
    const resolved = items
      .map((m) => getHrefFromLink(m))
      .filter((x): x is { href: string; label: string } => Boolean(x));
    return resolved;
  }, [primaryNavigation]);

  const logoSrc = useMemo(() => {
    if (!primaryLogo) return null;
    if (typeof primaryLogo === "string") return null;
    return (primaryLogo as Media).url || null;
  }, [primaryLogo]);

  const logoAlt = useMemo(() => {
    if (!primaryLogo) return "";
    if (typeof primaryLogo === "string") return "Logo";
    return primaryLogo.alt || "Logo";
  }, [primaryLogo]);

  const toggleMobile = () => setMobileOpen((o) => !o);

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
          <Section>
            <Box sx={{ py: { lg: theme.typography.pxToRem(54) } }}>
              <Grid
                container
                alignItems="center"
                justifyContent="space-between"
              >
                {/* Logo */}
                <Grid size={5}>
                  <IconButton
                    component={NextLink}
                    href="/"
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
                        PromiseTracker
                      </Box>
                    )}
                  </IconButton>
                </Grid>

                {/* Desktop navigation */}
                <Grid
                  size={5}
                  sx={{
                    display: { xs: "none", lg: "flex" },
                    paddingLeft: "1rem",
                  }}
                  container
                  justifyContent="flex-end"
                  alignItems="center"
                  columnGap={1}
                >
                  {menus.map((m) => (
                    <Grid key={m.href + m.label}>
                      <Button
                        component={NextLink}
                        href={m.href}
                        size="large"
                        sx={(theme) => ({
                          height: 48,
                          border: 0,
                          color: theme.palette.primary.main,
                          padding: "0.8rem  1.2rem",
                          margin: "0.3rem",
                          textTransform: "uppercase",
                          fontFamily: theme.typography.fontFamily,
                          letterSpacing: "0.56px",
                          fontWeight: 600,
                          fontSize: theme.typography.pxToRem(14),
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          "&:hover": {
                            border: 0,
                            backgroundColor: theme.palette.secondary.light,
                          },
                        })}
                      >
                        {m.label}
                      </Button>
                    </Grid>
                  ))}
                </Grid>

                <Grid size={2} sx={{ display: { xs: "none", lg: "flex" } }}>
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

                {/* Mobile actions */}
                <Grid
                  sx={{
                    display: { xs: "flex", lg: "none" },
                    justifyContent: "flex-end",
                  }}
                >
                  <IconButton
                    aria-label="Search"
                    color="secondary"
                    sx={{ mr: 1 }}
                  >
                    <SearchIcon />
                  </IconButton>
                  <IconButton
                    aria-label="Open menu"
                    onClick={toggleMobile}
                    sx={{ color: theme.palette.primary.main }}
                  >
                    <MenuIcon />
                  </IconButton>
                </Grid>
              </Grid>
            </Box>
          </Section>
        </Box>
      </Toolbar>

      {/* Mobile drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={toggleMobile}
        PaperProps={{
          sx: {
            width: "100%",
            height: "100%",
            backgroundColor: "#005DFD",
            color: theme.palette.background.default,
          },
        }}
      >
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          {/* Top actions (close) */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              px: {
                xs: theme.typography.pxToRem(21.5),
                lg: theme.typography.pxToRem(33),
              },
              py: 1,
            }}
          >
            <IconButton
              onClick={toggleMobile}
              aria-label="Close"
              sx={{ color: theme.palette.background.default }}
            >
              <CloseIcon fontSize="large" />
            </IconButton>
          </Box>

          {/* Menu list */}
          <Box sx={{ flex: 1, overflowY: "auto" }} onClick={toggleMobile}>
            <Section>
              <List sx={{ p: 0 }}>
                {menus.map((m, idx) => (
                  <ListItem
                    key={m.href + m.label}
                    disableGutters
                    sx={{
                      display: "block",
                      py: idx === 0 ? theme.typography.pxToRem(2) : 0,
                    }}
                  >
                    <ListItemButton
                      component={NextLink}
                      href={m.href}
                      sx={{
                        py: theme.typography.pxToRem(40),
                        "&:hover": { backgroundColor: "transparent" },
                      }}
                    >
                      <ListItemText
                        primary={m.label}
                        primaryTypographyProps={{
                          variant: "h4",
                          sx: {
                            textTransform: "uppercase",
                            fontWeight: 600,
                            letterSpacing: "0.72px",
                            fontSize: theme.typography.pxToRem(18),
                            color: theme.palette.background.default,
                          },
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Section>
          </Box>
        </Box>
      </Drawer>
    </AppBar>
  );
}
