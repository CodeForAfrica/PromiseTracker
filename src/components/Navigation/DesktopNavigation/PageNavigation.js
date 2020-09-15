import React from "react";
import PropTypes from "prop-types";

import clsx from "clsx";

import { Grid } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import LinkButton from "components/Link/Button";

const useStyles = makeStyles(({ palette, typography }) => ({
  root: {
    width: "100%",
    backgroundColor: palette.background.paper,
    boxShadow: "0px 8px 30px #0000001A",
  },
  button: {
    width: "auto",
    fontWeight: "normal",
    color: "#909090",
    textTransform: "uppercase",
    fontFamily: typography.fontFamily,
  },
  navigation: {
    padding: "1rem 10rem",
  },
}));

function PageNavigation({ navigation, ...props }) {
  const classes = useStyles(props);
  const className = clsx(classes.button, classes.buttonCurrent);
  return (
    <div className={classes.root}>
      <Grid
        container
        direction="row"
        justify="space-between"
        className={classes.navigation}
      >
        {navigation.map((menu) => (
          <Grid item key={menu.href}>
            <LinkButton href={menu.href} size="large" className={className}>
              {menu.name}
            </LinkButton>
          </Grid>
        ))}
      </Grid>
    </div>
  );
}

PageNavigation.propTypes = {
  navigation: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      href: PropTypes.string.isRequired,
    })
  ).isRequired,
};

export default PageNavigation;
