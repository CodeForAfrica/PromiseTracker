import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(({ palette, typography, breakpoints }) => ({
  root: {
    "& .MuiButton-contained.Mui-disabled": {
      backgroundColor: "#909090",
      color: palette.common.white,
      "&:hover": {
        backgroundColor: "#909090",
        color: palette.common.white,
      },
    },
  },
  authButton: {
    backgroundColor: palette.primary.dark,
    color: palette.common.white,
    marginTop: typography.pxToRem(20),
    minWidth: typography.pxToRem(74),
    "&:hover": {
      backgroundColor: palette.primary.dark,
    },
    [breakpoints.up("lg")]: {
      paddingBottom: typography.pxToRem(15),
      paddingTop: typography.pxToRem(14),
      minWidth: typography.pxToRem(158),
    },
  },
  inputProps: {
    paddingLeft: typography.pxToRem(10),
    fontFamily: typography.h5.fontFamily,
    fontSize: typography.h5.fontSize,
  },
  input: {
    border: "none",
  },
}));

export default useStyles;
