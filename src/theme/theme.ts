"use client";

import { createTheme } from "@mui/material/styles";
import { deepmerge } from "@mui/utils";
import { tokens } from "./tokens";

const primary = { main: "#202020", dark: "#000000" } as const;
const secondary = { main: "#EBEBEB", light: "#F7F7F7" } as const; // grey
const text = { primary: primary.main, secondary: "#ffffff" } as const;

const baseTheme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1360,
      xl: 1920,
    },
  },
  palette: {
    background: { default: "#fff" },
    primary,
    secondary,
    text,
    // Map legacy highlight + chart tones into standard slots
    info: { main: tokens.highlight.main, light: tokens.highlight.faded },
    warning: { main: tokens.highlight.light },
    mode: "light",
  },
  typography: {
    fontFamily: "inter",
    h1: {
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: "bold",
      letterSpacing: "0.76px",
    },
    h2: {
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: "normal",
      letterSpacing: "0.86px",
    },
    h3: {
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: "bold",
    },
    h4: {
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: 600,
      letterSpacing: "0.64px",
    },
    h5: {
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: 600,
      letterSpacing: "0.56px",
      textTransform: "uppercase",
    },
    h6: {
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: 700,
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    subtitle1: {
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: 600,
      letterSpacing: 0,
    },
    subtitle2: {
      fontStretch: "normal",
      fontStyle: "regular",
      fontWeight: "bold",
      letterSpacing: 0,
    },
    body1: {
      fontStretch: "normal",
      fontWeight: "normal",
      letterSpacing: 0,
    },
    body2: {
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: 400,
      letterSpacing: 0,
    },
    caption: {
      fontStretch: "normal",
      fontStyle: "normal",
      letterSpacing: 0,
    },
    button: {
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: 600,
      letterSpacing: 0,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          maxWidth: "100%",
          overflowX: "hidden",
          height: "100%",
        },
        body: {
          maxWidth: "100%",
          overflowX: "hidden",
          height: "100%",
        },
        "#__next": {
          height: "100%",
        },
      },
    },
  },
});

// Apply responsive font sizes and component overrides that depend on the base theme
const { breakpoints, typography, palette } = baseTheme;
const { pxToRem } = typography;

const theme = createTheme(baseTheme, {
  typography: deepmerge(
    {},
    {
      h1: {
        color: palette.primary.dark,
        fontSize: pxToRem(32),
        lineHeight: 40 / 32,
        fontWeight: 700,
        [breakpoints.up("lg")]: {
          fontSize: pxToRem(36),
          lineHeight: 56 / 36,
          padding: `${pxToRem(12)} 0`,
        },
      },
      h2: {
        fontSize: pxToRem(32),
        lineHeight: 48 / 32,
        padding: `${pxToRem(12)} 0`,
        [breakpoints.up("lg")]: {
          fontSize: pxToRem(36),
          lineHeight: 40 / 36,
        },
      },
      h3: {
        color: palette.primary.dark,
        fontSize: pxToRem(24),
        lineHeight: 32 / 24,
        [breakpoints.up("lg")]: {
          fontSize: pxToRem(24),
          lineHeight: 32 / 24,
        },
      },
      h4: {
        fontSize: pxToRem(16),
        lineHeight: 24 / 16,
        [breakpoints.up("lg")]: {
          fontSize: pxToRem(16),
          lineHeight: 24 / 16,
        },
      },
      h5: {
        fontSize: pxToRem(14),
        lineHeight: 16 / 14,
        [breakpoints.up("lg")]: {
          color: palette.primary.main,
          fontSize: pxToRem(14),
          lineHeight: 16 / 14,
        },
      },
      h6: {
        fontSize: pxToRem(10),
        lineHeight: 16 / 10,
        [breakpoints.up("lg")]: {
          fontSize: pxToRem(10),
          lineHeight: 24 / 10,
        },
      },
      body1: {
        fontSize: pxToRem(18),
        lineHeight: 40 / 18,
        [breakpoints.up("lg")]: {
          fontSize: pxToRem(18),
          lineHeight: 40 / 18,
        },
      },
      body2: {
        fontSize: pxToRem(13),
        lineHeight: 24 / 13,
        [breakpoints.up("lg")]: {
          fontSize: pxToRem(14),
          lineHeight: 24 / 14,
        },
      },
      subtitle1: {
        fontSize: pxToRem(14),
        lineHeight: 24 / 14,
        [breakpoints.up("lg")]: {
          fontSize: pxToRem(12),
          lineHeight: 14.4 / 12,
        },
      },
      subtitle2: {
        fontSize: pxToRem(7),
        lineHeight: 19 / 7,
        [breakpoints.up("lg")]: {
          fontSize: pxToRem(10),
          lineHeight: 24 / 10,
        },
      },
      caption: {
        [breakpoints.up("lg")]: {
          fontSize: pxToRem(12),
          lineHeight: 12 / 10,
        },
      },
      button: {
        fontSize: pxToRem(14),
        lineHeight: 18 / 14,
        [breakpoints.up("lg")]: {
          fontSize: pxToRem(14),
          lineHeight: 18 / 14,
        },
      },
    },
    { clone: false }
  ),
  components: {
    MuiButton: {
      styleOverrides: {
        contained: {
          backgroundColor: palette.primary.dark,
          border: "none",
          boxShadow: "none",
          color: palette.text.secondary,
          borderRadius: 0,
          "&:hover": {
            border: "none",
            boxShadow: "none",
          },
        },
        containedPrimary: {
          color: palette.text.secondary,
          backgroundColor: palette.info.main,
          border: "none",
          boxShadow: "none",
        },
        containedSecondary: {
          color: palette.info.main,
          backgroundColor: palette.secondary.main,
          border: "none",
          boxShadow: "none",
        },
        containedSizeSmall: {
          fontSize: typography.pxToRem(14),
          lineHeight: 18 / 14,
        },
        containedSizeLarge: {
          fontSize: typography.pxToRem(16),
          lineHeight: 24 / 16,
        },
        outlined: {
          backgroundColor: "transparent",
          border: `.122rem solid ${palette.primary.main}`,
          boxShadow: "none",
          boxSizing: "border-box",
          color: palette.primary.main,
          borderRadius: 0,
          "&:hover": {
            border: `.122rem solid ${palette.primary.main}`,
            boxShadow: "none",
          },
        },
        text: {
          backgroundColor: "transparent",
          boxShadow: "none",
          boxSizing: "border-box",
          color: palette.primary.main,
          borderRadius: 0,
          "&:hover": {
            boxShadow: "none",
          },
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          [breakpoints.up("xs")]: {
            maxWidth: "100%",
            paddingLeft: 16,
            paddingRight: 16,
          },
          [breakpoints.up("sm")]: { maxWidth: "600px" },
          [breakpoints.up("md")]: {
            maxWidth: "960px",
            paddingLeft: 0,
            paddingRight: 0,
          },
          [breakpoints.up("lg")]: { maxWidth: "1080px" },
        },
        // padding-left { xs: 16px, lg: 0 }
      },
    },
    MuiInputBase: {
      styleOverrides: {
        input: {
          fontSize: "14px",
        },
      },
    },
  },
});

export default theme;
