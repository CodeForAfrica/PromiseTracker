import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(({ breakpoints, typography, widths }) => ({
  section: {
    padding: `0 ${typography.pxToRem(23)}`,
    margin: 0,
    width: "100%",
    [breakpoints.up("lg")]: {
      padding: 0,
      margin: "0 auto",
      width: typography.pxToRem(widths.values.lg),
    },
  },
  sectionTitle: {},
  actNow: {
    marginTop: typography.pxToRem(52),
  },
  criteria: {
    marginTop: typography.pxToRem(60),
  },
  criteriaItems: {
    marginTop: typography.pxToRem(25),
  },
  description: {
    marginTop: typography.pxToRem(52),
    [breakpoints.up("lg")]: {
      marginTop: typography.pxToRem(0),
    },
  },
  grid: {},
  gridAside: {},
  gridMain: {},
  image: {
    display: "flex",
    margin: `0 auto`,
    minWidth: typography.pxToRem(257),
    width: typography.pxToRem(257),
    [breakpoints.up("lg")]: {
      marginTop: typography.pxToRem(0),
      maxWidth: typography.pxToRem(352),
      minWidth: typography.pxToRem(352),
    },
  },
  footer: {},
}));

export default useStyles;
