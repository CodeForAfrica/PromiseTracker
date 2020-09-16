import React from "react";

import logo from "assets/PT-logo-header-mob@2x.png";
import desktoplogo from "assets/PT-logo-header-desktop@2x.png";

import { useMediaQuery } from "@material-ui/core";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import IconButton from "@/promisetracker/components/Link/IconButton";

const useStyles = makeStyles(({ breakpoints }) => ({
  logo: {
    padding: "1rem",
    maxWidth: "100%",
    height: "auto",
    [breakpoints.up("md")]: {
      padding: 0,
    },
    "&:hover": {
      backgroundColor: "unset",
    },
  },
  img: {
    width: "135px",
    [breakpoints.up("md")]: {
      width: "236px",
    },
  },
}));

function Logo(props) {
  const classes = useStyles(props);
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
      <img src={src} alt="Promise Tracker Logo" className={classes.img} />
    </IconButton>
  );
}
export default Logo;
