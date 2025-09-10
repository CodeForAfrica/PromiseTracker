"use client";

import React, { useState } from "react";
import {
  Box,
  Container,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { CMSLink } from "@/components/CMSLink";
import type { MenuLink } from "@/types/navigation";

type MobileMenuProps = {
  menus: MenuLink[];
};

export function MobileMenu({ menus }: MobileMenuProps) {
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobile = () => setMobileOpen((o) => !o);

  return (
    <>
      {/* Mobile actions (search + open) */}
      <Grid
        sx={{
          display: { xs: "flex", lg: "none" },
          justifyContent: "flex-end",
        }}
      >
        <IconButton aria-label="Search" color="secondary" sx={{ mr: 1 }}>
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

      {/* Drawer */}
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
            <Container>
              <List sx={{ p: 0 }}>
                {menus.map((m, idx) => (
                  <ListItem
                    key={`${idx}-${m.type}-${m.url ?? (typeof m.reference?.value === "object" ? m.reference?.value?.slug : m.reference?.value) ?? m.label}`}
                    disableGutters
                    sx={{
                      display: "block",
                      py: idx === 0 ? theme.typography.pxToRem(2) : 0,
                    }}
                  >
                    <CMSLink
                      {...m}
                      label=""
                      sx={{
                        display: "block",
                        py: theme.typography.pxToRem(40),
                        "&:hover": { backgroundColor: "transparent" },
                        color: theme.palette.background.default,
                        textDecoration: "none",
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
                    </CMSLink>
                  </ListItem>
                ))}
              </List>
            </Container>
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
