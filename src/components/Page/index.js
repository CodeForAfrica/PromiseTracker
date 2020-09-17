import React from "react";
import PropTypes from "prop-types";

import { makeStyles } from "@material-ui/core/styles";

import Navigation from "@/promisetracker/components/Navigation";

const useStyles = makeStyles(() => ({
  root: {
    // Seems like you need height defined for AppBar position="sticky" to work
    // see: https://github.com/mui-org/material-ui/issues/16186
    height: "100vh",
    // font-boosting: https://stackoverflow.com/questions/13430897/how-to-override-font-boosting-in-mobile-chrome#comment61478376_16432702
    maxHeight: 999999,
    overflowX: "hidden",
  },
  section: {
    paddingTop: 0,
  },
}));
function Page({ children, ...props }) {
  const classes = useStyles(props);

  return (
    <div className={classes.root}>
      <Navigation classes={{ section: classes.section }} />
      {children}
    </div>
  );
}

Page.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
};

export default Page;
