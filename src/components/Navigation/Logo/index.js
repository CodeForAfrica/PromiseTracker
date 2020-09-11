import React from "react";

import logo from "assets/header-pt-logo-mobile.svg";
import desktoplogo from "assets/header-pt-logo.svg";

import { useMediaQuery } from "@material-ui/core";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import IconButton from "@/promisetracker/components/Link/IconButton";

const useStyles = makeStyles(({ breakpoints }) => ({
  logo: {
    padding: "1rem",
    [breakpoints.up("md")]: {
      padding: 0,
    },
    "&:hover": {
      backgroundColor: "unset",
    },
  },
}));

function Logo() {
  const classes = useStyles();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const src = isDesktop ? desktoplogo : logo;

  return (
    <IconButton
      disableRipple
      disableFocusRipple
      href="/"
      className={classes.logo}
    >
      <img src={src} alt="Promise Tracker Logo" />
    </IconButton>
  );
}
export default Logo;
