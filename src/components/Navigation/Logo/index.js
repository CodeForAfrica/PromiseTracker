import React from "react";
import logo from "assets/header-pt-logo.svg";
import { makeStyles } from "@material-ui/core/styles";
import IconButton from "@/promisetracker/components/Link/IconButton";

const useStyles = makeStyles(() => ({
  logo: {
    padding: 0,
    "&:hover": {
      backgroundColor: "unset",
    },
  },
}));

function Logo() {
  const classes = useStyles();
  return (
    <IconButton
      disableRipple
      disableFocusRipple
      href="/"
      className={classes.logo}
    >
      <img src={logo} alt="Promise Tracker Logo" />
    </IconButton>
  );
}
export default Logo;
