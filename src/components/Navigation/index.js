import React from "react";

import { AppBar, Toolbar, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(({ breakpoints, palette }) => ({
  root: {
    backgroundColor: palette.background.default,
    boxShadow: "0px 8px 30px #0000001A",
    [breakpoints.up("md")]: {
      boxShadow: "0px 8px 30px #0000001A",
    },
  },
}));

function Navigation() {
  const classes = useStyles();
  return (
    <>
      <AppBar color="primary" position="sticky" className={classes.root}>
        <Toolbar>
          <Typography style={{ color: "black" }}>example toolbar</Typography>
        </Toolbar>
      </AppBar>
    </>
  );
}

export default Navigation;
