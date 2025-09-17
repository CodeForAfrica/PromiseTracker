import React from "react";
import Grid from "@mui/material/Grid";
import { CMSLink } from "@/components/CMSLink";
import type { MenuLink } from "@/types/navigation";

type DesktopMenuProps = {
  menus: MenuLink[];
  entitySlug?: string;
};

export function DesktopMenu({ menus, entitySlug }: DesktopMenuProps) {
  return (
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
      {menus.map((m, idx) => (
        <Grid
          key={`${idx}-${m.type}-${m.url ?? (typeof m.reference?.value === "object" ? m.reference?.value?.slug : m.reference?.value) ?? m.label}`}
        >
          <CMSLink
            {...m}
            entitySlug={entitySlug}
            sx={(theme) => ({
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
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
              textDecoration: "none",
              "&:hover": {
                border: 0,
                backgroundColor: theme.palette.secondary.light,
                textDecoration: "none",
              },
            })}
          />
        </Grid>
      ))}
    </Grid>
  );
}
