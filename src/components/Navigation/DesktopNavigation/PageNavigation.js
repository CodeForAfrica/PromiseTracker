import React from "react";
import PropTypes from "prop-types";

import { Grid } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { Section } from "@commons-ui/core";

import LinkButton from "components/Link/Button";
import config from "@/promisetracker/config";

const useStyles = makeStyles(({ breakpoints, palette, typography }) => ({
  root: {
    width: "100%",
  },
  section: {},
  button: {
    marginRight: "0.5rem",
    width: "auto",
    color: "#9D9C9C",
    [breakpoints.up("lg")]: {
      marginRight: "2rem",
    },
    [breakpoints.up("xl")]: {
      marginRight: "4rem",
    },
  },
  buttonCurrent: {
    color: palette.secondary.main,
  },
  navigation: {
    height: typography.pxToRem(50),
    [breakpoints.up("xl")]: {
      height: typography.pxToRem(70),
    },
  },
}));

function PageNavigation({ ...props }) {
  const classes = useStyles(props);
  const { navigationMenu } = config;
  return (
    <div className={classes.root}>
      <Section classes={{ root: classes.section }}>
        <Grid
          container
          direction="row"
          justify="space-evenly"
          alignItems="center"
          className={classes.navigation}
        >
          {navigationMenu.map((menu) => (
            <Grid item key={menu.href}>
              <LinkButton href={menu.href} size="small">
                {menu.name}
              </LinkButton>
            </Grid>
          ))}
        </Grid>
      </Section>
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
