import React from "react";
import PropTypes from "prop-types";

import classNames from "classnames";

import { Grid, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { Section } from "@commons-ui/core";

import LinkButton from "components/Link/Button";

const useStyles = makeStyles(({ breakpoints, palette, typography }) => ({
  root: {
    width: "100%",
  },
  section: {},
  button: {
    marginRight: "0.5rem",
    width: "auto",
    fontWeight: 600,
  },
  buttonCurrent: {
    color: palette.primary.main,
  },
  navigation: {
    height: typography.pxToRem(50),
    [breakpoints.up("xl")]: {
      height: typography.pxToRem(70),
    },
  },
}));

function PageNavigation({ navigation, ...props }) {
  const classes = useStyles(props);
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
          {navigation.map((menu) => (
            <Grid item key={menu.href}>
              <LinkButton
                href={menu.href}
                size="large"
                className={classNames(classes.button, {
                  [classes.buttonCurrent]: classes.buttonCurrent,
                })}
              >
                <Typography variant="h5">{menu.name}</Typography>
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
