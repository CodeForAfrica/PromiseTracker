import { deepmerge } from '@material-ui/utils';

import createTheme from '@hurumap-ui/charts/styles/createTheme';

const FONT_FAMILY_HEADING = '"Amiri", "serif"';
const FONT_FAMILY_TEXT_SECONDARY = '"Open Sans", "sans-serif"';
const FONT_FAMILY_TEXT_HIGHTLIGHT = '"Source Sans Pro", "sans-serif"';

// ## DEFAULT
const theme = createTheme({
  palette: {
    background: { default: '#fff' },
    primary: { main: '#202020', dark: '#000000' },
    secondary: {
      main: '#EBEBEB',
      light: '#F7F7F7',
    },
    highlight: { main: '#005DFD', light: '#FFB322', faded: '#90DAFF' },
  },
  typography: {
    fontFamily: FONT_FAMILY_TEXT_SECONDARY,
    h1: {
      fontFamily: FONT_FAMILY_HEADING,
      fontStretch: 'normal',
      fontStyle: 'normal',
      fontWeight: 'bold',
      letterSpacing: '0.76px',
    },
    h2: {
      fontFamily: FONT_FAMILY_HEADING,
      fontStretch: 'normal',
      fontStyle: 'normal',
      fontWeight: 'normal',
      letterSpacing: '0.86px',
    },
    h3: {
      fontFamily: FONT_FAMILY_HEADING,
      fontStretch: 'normal',
      fontStyle: 'normal',
      fontWeight: 'bold',
    },
    h4: {
      fontFamily: FONT_FAMILY_TEXT_SECONDARY,
      fontStretch: 'normal',
      fontStyle: 'normal',
      fontWeight: 600,
      letterSpacing: '0.64px',
      textTransform: 'uppercase',
    },
    h5: {
      fontFamily: FONT_FAMILY_TEXT_SECONDARY,
      fontStretch: 'normal',
      fontStyle: 'normal',
      fontWeight: 600,
      letterSpacing: 0,
      textTransform: 'uppercase',
    },
    h6: {
      fontFamily: FONT_FAMILY_TEXT_SECONDARY,
      fontStretch: 'normal',
      fontStyle: 'normal',
      fontWeight: 700,
      letterSpacing: 0,
      textTransform: 'uppercase',
    },
    subtitle1: {
      fontFamily: FONT_FAMILY_TEXT_SECONDARY,
      fontStretch: 'normal',
      fontStyle: 'regular',
      letterSpacing: 0,
    },
    subtitle2: {
      fontFamily: FONT_FAMILY_TEXT_SECONDARY,
      fontStretch: 'normal',
      fontStyle: 'italic',
      fontWeight: 'normal',
      letterSpacing: 0,
    },
    body1: {
      fontFamily: FONT_FAMILY_TEXT_SECONDARY,
      fontStretch: 'normal',
      fontStyle: 'italic',
      fontWeight: 500,
      letterSpacing: 0,
    },
    body2: {
      fontFamily: FONT_FAMILY_TEXT_SECONDARY,
      fontStretch: 'normal',
      fontStyle: 'normal',
      fontWeight: 400,
      letterSpacing: 0,
    },
    caption: {
      fontFamily: FONT_FAMILY_TEXT_SECONDARY,
      fontStretch: 'normal',
      fontStyle: 'normal',
      letterSpacing: 0,
    },
    button: {
      fontFamily: FONT_FAMILY_TEXT_HIGHTLIGHT,
      fontStretch: 'normal',
      fontStyle: 'normal',
      color: 'white',
      fontWeight: 600,
      letterSpacing: 0,
      textTransform: 'none',
    },
  },
  overrides: {
    MuiCssBaseline: {
      '@global': {
        html: {
          maxWidth: '100%',
          overflowX: 'hidden',
          height: '100%',
        },
        body: {
          maxWidth: '100%',
          overflowX: 'hidden',
          height: '100%',
        },
        // Next.js root div
        '#__next': {
          height: '100%',
        },
      },
    },
  },
  widths: {
    values: {
      md: 912, // 0, 24, 0, 24 margins
      lg: 1200, // 0, 40, 0, 40 margins
      xl: 1640, // 0, 140, 0, 140 margins DESIGNS
    },
  },
});

// ## RESPONSIVE FONTS
const { breakpoints, typography, palette } = theme;
const { pxToRem } = typography;
deepmerge(
  typography,
  {
    h1: {
      color: palette.primary.dark,
      fontSize: pxToRem(32),
      lineHeight: 32 / 40,
      fontWeight: 700,
      [breakpoints.up('md')]: {
        fontSize: pxToRem(38),
        lineHeight: 38 / 56,
      },
    },
    h2: {
      color: palette.primary.main,
      fontSize: pxToRem(32),
      lineHeight: 32 / 48,
      [breakpoints.up('md')]: {
        fontSize: pxToRem(36),
        lineHeight: 36 / 56,
      },
    },
    h3: {
      color: palette.primary.dark,
      fontSize: pxToRem(16),
      lineHeight: 16 / 35,
      [breakpoints.up('md')]: {
        fontSize: pxToRem(24),
        lineHeight: 24 / 28.8,
      },
    },
    h4: {
      color: palette.primary.main,
      fontSize: pxToRem(16),
      lineHeight: 16 / 24,
      [breakpoints.up('md')]: {
        fontSize: pxToRem(16),
        lineHeight: 16 / 24,
      },
    },
    h5: {
      color: palette.background.main,
      fontSize: pxToRem(18),
      lineHeight: 18 / 21,
      [breakpoints.up('md')]: {
        color: palette.primary.main,
        fontSize: pxToRem(14),
        lineHeight: 14 / 24,
      },
    },
    subtitle1: {
      fontSize: pxToRem(16),
      lineHeight: 24 / 16,
      [breakpoints.up('xl')]: {
        fontSize: pxToRem(28),
        lineHeight: 45 / 28,
      },
    },
    subtitle2: {
      fontSize: pxToRem(16),
      lineHeight: 23 / 16,
      [breakpoints.up('xl')]: {
        fontSize: pxToRem(24),
        lineHeight: 30 / 24,
      },
    },
    body1: {
      fontSize: pxToRem(14),
      lineHeight: 18 / 14,
      [breakpoints.up('md')]: {
        fontSize: pxToRem(18),
        lineHeight: 23 / 18,
      },
      [breakpoints.up('xl')]: {
        fontSize: pxToRem(24),
        lineHeight: 31 / 24,
      },
    },
    body2: {
      fontSize: pxToRem(12),
      lineHeight: 15 / 12,
      [breakpoints.up('md')]: {
        fontSize: pxToRem(16),
        lineHeight: 20 / 16,
      },
    },
    caption: {
      fontSize: pxToRem(16),
      lineHeight: 24 / 16,
      [breakpoints.up('xl')]: {
        fontSize: pxToRem(20),
        lineHeight: 30 / 20,
      },
    },
    button: {
      fontSize: pxToRem(12),
      lineHeight: 15 / 12,
      letterSpacing: pxToRem(1.6),
      [breakpoints.up('xl')]: {
        fontSize: pxToRem(20),
        lineHeight: 24 / 20,
      },
    },
  },
  { clone: false },
);

// ## OVERRIDES
deepmerge(
  theme.overrides,
  {
    // Style sheet name ⚛️
    MuiButton: {
      // Name of the rule
      contained: {
        backgroundColor: palette.primary.main,
        border: 'none',
        boxShadow: 'none',
        color: palette.text.secondary,
        '&:hover': {
          border: 'none',
          boxShadow: 'none',
        },
      },
      containedPrimary: {
        backgroundColor: palette.primary.main,
        border: 'none',
        boxShadow: 'none',
        color: palette.text.secondary,
      },
      containedSizeSmall: {
        fontSize: typography.pxToRem(14),
        lineHeight: 18 / 14,
        [breakpoints.up('xl')]: {
          fontSize: typography.pxToRem(16),
        },
      },
      containedSizeLarge: {
        fontSize: typography.pxToRem(16),
        lineHeight: 24 / 16,
        [breakpoints.up('xl')]: {
          fontSize: typography.pxToRem(24),
          lineHeight: 24 / 24,
        },
      },
    },
  },
  { clone: false },
);

export default theme;
