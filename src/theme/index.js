import { buttonClasses } from "@mui/material";
import { deepmerge } from "@mui/utils";
import createTheme from "./createTheme";
import {
  Inter,
  Open_Sans as OpenSans,
  Amiri,
  Merriweather,
  Source_Sans_3 as SourceSansPro,
} from "next/font/google";

const neutral = {
  100: "#F7F7F7",
  200: "#CCCED9",
  300: "#828499",
  400: "#3E4159",
  500: "#02041C",
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const openSans = OpenSans({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});
const amiri = Amiri({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
});

const merriweather = Merriweather({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
});

const sourceSansPro = SourceSansPro({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
});

const FONT_FAMILY_HEADING = amiri.style.fontFamily;
const FONT_FAMILY_TEXT_PRIMARY = merriweather.style.fontFamily;
const FONT_FAMILY_TEXT_SECONDARY = openSans.style.fontFamily;
const FONT_FAMILY_TEXT_HIGHTLIGHT = sourceSansPro.style.fontFamily;
const FONT_FAMILY_SECONDARY = openSans.style.fontFamily;

const palette = {
  mode: "light",
  primary: { main: "#000000" },
  neutral: { light: neutral[200], main: neutral[500], dark: neutral[900] },
  error: { main: "#FF0000" },
  grey: { main: "#B4ABAB", light: "#E3DFDF" },
  warning: { main: "#FEFF05" },
  success: { main: "#34D399" },
  text: { primary: "#202020", secondary: "#FFFFFF" },
  yellow: { main: "#FEFF05" },
  background: {
    default: neutral[100],
  },
  action: { focusOpacity: 0 },
};

const breakpoints = {
  values: {
    xs: 0,
    sm: 768,
    md: 1152,
    lg: 1440,
    xl: 1920,
  },
};

function initializeTypographyVariant(
  fontSize,
  lineHeight,
  fontWeight = 400,
  fontFamily = FONT_FAMILY_SECONDARY,
  others = undefined,
) {
  return {
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight: lineHeight / fontSize,
    ...others,
  };
}

const theme = createTheme({
  palette,
  breakpoints,
  contentWidths: {
    values: {
      sm: 728,
      md: 1024,
      lg: 1160,
      xl: 1240,
    },
    unit: "px",
  },
  typography: {
    fontFamily: FONT_FAMILY_TEXT_SECONDARY,
    // PT H1
    h1: {
      fontFamily: FONT_FAMILY_HEADING,
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: "bold",
      letterSpacing: "0.76px",
    },
    // PT H2
    h2: {
      fontFamily: FONT_FAMILY_HEADING,
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: "normal",
      letterSpacing: "0.86px",
    },
    // PT H3
    h3: {
      fontFamily: FONT_FAMILY_HEADING,
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: "bold",
      fontSize: "24px",
    },
    // PT H4
    h4: {
      fontFamily: FONT_FAMILY_TEXT_SECONDARY,
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: 600,
      letterSpacing: "0.64px",
      textTransform: "uppercase",
    },
    // PT H5
    h5: {
      fontFamily: FONT_FAMILY_TEXT_SECONDARY,
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: 600,
      letterSpacing: "0.56px",
      textTransform: "Uppercase",
    },
    // PT H6
    h6: {
      fontFamily: FONT_FAMILY_TEXT_SECONDARY,
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: 700,
      letterSpacing: 0,
      textTransform: "Uppercase",
    },
    subtitle1: {
      fontFamily: FONT_FAMILY_TEXT_SECONDARY,
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: 600,
      letterSpacing: 0, // Status in chart section/component
    },
    subtitle2: {
      fontFamily: FONT_FAMILY_TEXT_SECONDARY,
      fontStretch: "normal",
      fontStyle: "regular",
      fontWeight: "bold",
      letterSpacing: 0, // Status text=> Handles H7/H8 text for status button content
    },
    // PT Body Normal
    body1: {
      fontFamily: FONT_FAMILY_TEXT_PRIMARY,
      fontStretch: "normal",
      fontWeight: "normal",
      letterSpacing: 0,
    },
    // PT Body Small
    body2: {
      fontFamily: FONT_FAMILY_TEXT_PRIMARY,
      fontStretch: "normal",
      fontStyle: "normal",
      fontWeight: 400,
      letterSpacing: 0,
      fontSize: "14px",
    },
    caption: {
      fontFamily: FONT_FAMILY_TEXT_SECONDARY,
      fontStretch: "normal",
      fontStyle: "normal",
      letterSpacing: 0, // Chart percentage text
      fontSize: "10px",
    },
    button: {
      fontFamily: FONT_FAMILY_TEXT_HIGHTLIGHT,
      fontStretch: "normal",
      fontStyle: "normal",
      color: "white",
      fontWeight: 600,
      letterSpacing: 0,
    },
  },
  components: {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
      },
    },
    MuiTypography: {
      defaultProps: {
        variant: "p1",
        variantMapping: {
          h1: "h1",
          h2: "h2",
          h3: "h3",
          subheading1: "h6",
          subheading2: "h6",
          p1: "p",
          p2: "p",
          p3: "p",
          p4: "p",
          banner: "p",
          footer: "p",
          display4: "h2",
        },
      },
    },
  },
});

// deepmerge font-size so that we don't overide other settings such as
// font-family set above
deepmerge(
  theme.typography,
  {
    button: {
      ...theme.typography.button,
      textTransform: "uppercase",
    },
  },
  { clone: false },
);

deepmerge(
  theme.components,
  {
    MuiButton: {
      styleOverrides: {
        root: {
          ...theme.typography.button,
          boxShadow: "none",
          border: "1px solid",
          gap: "8px",
          borderRadius: "0",
          backgroundColor: "#ffffff",
          color: "#463E3E",
          "&:hover": {
            backgroundColor: "#F6F5F5",
          },
          "&:active": {
            backgroundColor: "#FFFFFF",
          },
          [`&.${buttonClasses.disabled}`]: {
            backgroundColor: "#E6E6E6",
            color: "#888888",
            borderColor: "#000000",
          },
        },
        containedPrimary: {
          backgroundColor: "#252B37",
          color: "#FFFFFF",
          "&:active": {
            backgroundColor: "#A0A0A0",
          },
          "&:hover": {
            backgroundColor: "#727272",
          },
        },
        sizeSmall: {
          padding: "12px",
        },
        sizeLarge: {
          padding: "13px 20px",
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: `
       #__next {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
       }
      `,
    },
  },
  { clone: false },
);

export default theme;
