import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(({ breakpoints, typography }) => ({
  root: {
    [breakpoints.up("lg")]: {
      maxHeight: typography.pxToRem(518),
    },
  },
  content: {},
  contentRoot: {},
  date: {},
  description: {
    textTransform: "none",
  },
  descriptionContainer: {
    height: "auto",
    [breakpoints.up("lg")]: {
      height: 24 * 3, // Max 3 lines defined by body2.lineHeight
    },
  },
  link: {
    color: "unset",
    "&:hover": {
      textDecoration: "none",
      color: "unset",
    },
  },
  media: {},
  share: {},
  status: {},
  title: {},
  titleContainer: {},
}));

export default useStyles;
