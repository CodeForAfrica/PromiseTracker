import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(({ typography, breakpoints }) => ({
  section: {},
  root: {
    width: "100%",
    backgroundColor: "#F7F7F7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    [breakpoints.up("lg")]: {
      padding: `${typography.pxToRem(25)} 0`,
    },
  },
  title: {
    backgroundColor: "#F7F7F7",
    borderRadius: "10px",
    "& h2": {
      textTransform: "none",
      fontFamily: typography.h2.fontFamily,
      fontSize: typography.pxToRem(30),
      fontWeight: "100",
    },
  },
  description: {
    color: "black",
  },
  label: {
    color: "black",
    position: "static",
    transform: "none",
    textTransform: "uppercase",
    fontFamily: typography.fontFamily,
    fontWeight: 600,
    fontSize: typography.pxToRem(16),
  },
  recipientLabel: {
    textTransform: "uppercase",
    fontFamily: typography.fontFamily,
    fontWeight: "bold",
    fontSize: typography.pxToRem(10),
    color: "#909090",
    position: "static",
    marginBottom: typography.pxToRem(10),
  },
  helperText: {
    color: "black",
    fontFamily: typography.body2.fontFamily,
    margin: `${typography.pxToRem(10)} 0 ${typography.pxToRem(10)} 0`,
    fontSize: typography.pxToRem(16),
    lineHeight: "1.8",
  },
  input: {
    border: "1px solid #EBEBEB",
    backgroundColor: "#F7F7F7",
    borderRadius: typography.pxToRem(5),
  },
  underline: {
    "&::before": {
      borderBottom: 0,
    },
  },
  formControl: {
    width: "100%",
    marginTop: typography.pxToRem(40),
    "& textarea": {
      backgroundColor: "#F7F7F7",
      border: "1px solid #EBEBEB",
    },
  },
  formControlRecipient: {
    width: "100%",
  },
  body1: {
    marginTop: typography.pxToRem(40),
  },
  imageInput: {
    backgroundColor: "#F7F7F7",
    height: typography.pxToRem(50),
    minWidth: "-webkit-fill-available",
    "& input": {
      display: "none",
    },
  },
  imageThumbnail: {
    width: typography.pxToRem(150),
    height: typography.pxToRem(150),
    objectFit: "contain",
    marginLeft: typography.pxToRem(30),
  },
  imageContainer: {
    backgroundColor: "#F7F7F7",
  },
  uploadButton: {
    color: "#909090",
    backgroundColor: "#FFFFFF",
    border: "1px solid #909090",
    borderRadius: typography.pxToRem(10),
    fontSize: typography.pxToRem(12),
    "&:hover": {
      color: "#005DFD",
    },
  },
  button: {
    margin: 0,
    paddingBottom: typography.pxToRem(30),
  },
  inputText: {
    textAlign: "center",
    textTransform: "uppercase",
    fontFamily: typography.fontFamily,
    fontSize: typography.pxToRem(12),
    fontWeight: "bold",
    color: "#20202059",
    letterSpacing: "0.4px",
    paddingTop: typography.pxToRem(10),
  },
}));

export default useStyles;
