import React from "react";
import { Grid, Link } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import classNames from "classnames";

import { Section } from "@commons-ui/core";
import Logo from "@/promisetracker/components/Navigation/Logo";
import Search from "@/promisetracker/components/Search";
import MainNavigation from "@/promisetracker/components/Navigation/DesktopNavigation/MainNavigation";

import config from "@/promisetracker/config";

const useStyles = makeStyles(({ breakpoints }) => ({
  logo: {},
  section: {
    padding: "3rem 5rem",
  },
  navigation: {},
  button: {
    paddingLeft: 0,
    paddingRight: 0,
    marginRight: "0.5rem",
    "&:hover": {
      backgroundColor: "white",
    },
    width: "auto",
    [breakpoints.up("lg")]: {
      marginRight: "2rem",
    },
    [breakpoints.up("xl")]: {
      marginRight: "4rem",
    },
  },
  buttonLanguage: {
    color: "#9D9C9C",
    "&.active": {
      color: "#D6D6D6",
    },
    marginLeft: "0.75rem",
    width: "auto",
    [breakpoints.up("lg")]: {
      marginLeft: "1.25rem",
    },
    [breakpoints.up("xl")]: {
      marginLeft: "2rem",
    },
  },
  buttonLanguageLast: {
    marginRight: "-5.5rem",
  },
}));

function DesktopNavigation(props) {
  const classes = useStyles(props);
  const { navigationMenu } = config;
  return (
    <Grid container className={classes.root}>
      <Grid item xs={12}>
        <Section classes={{ root: classes.section }}>
          <Grid
            container
            justify="flex-start"
            alignItems="center"
            className={classes.navigation}
          >
            <Grid item md={3}>
              <Logo />
            </Grid>
            <Grid item md={5}>
              <MainNavigation navigation={navigationMenu} />
            </Grid>
            <Grid item md={3}>
              <Search />
            </Grid>

            <Grid item md={1} direction="column" container justify="flex-start">
              <Grid item>
                <Link
                  href="/#"
                  underline="none"
                  variant="overline"
                  className={classNames(classes.buttonLanguage, "active")}
                >
                  En
                </Link>
                {/* TODO(kilemens): Hide other languages for MVP */}

                <Link
                  href="/#"
                  underline="none"
                  variant="overline"
                  className={classNames(classes.buttonLanguage)}
                >
                  Am
                </Link>
              </Grid>

              <Grid item>
                <Link
                  href="/#"
                  underline="none"
                  variant="overline"
                  className={classNames(classes.buttonLanguage, "active")}
                >
                  Fr
                </Link>
                {/* TODO(kilemens): Hide other languages for MVP */}

                <Link
                  href="/#"
                  underline="none"
                  variant="overline"
                  className={classNames(
                    classes.buttonLanguage,
                    classes.buttonLanguageLast
                  )}
                >
                  عربى
                </Link>
              </Grid>
            </Grid>
            <Grid />
          </Grid>
        </Section>
      </Grid>
    </Grid>
  );
}

export default DesktopNavigation;
