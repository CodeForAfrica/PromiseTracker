import React from "react";
import PropTypes from "prop-types";

import { Grid, Hidden, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { Section } from "@commons-ui/core";

import Profile from "@/promisetracker/components/Hero/Profile";
import ProfileChart from "@/promisetracker/components/Hero/ProfileChart";

const useStyles = makeStyles(({ breakpoints, typography }) => ({
  root: {
    marginBottom: typography.pxToRem(40),
    marginTop: typography.pxToRem(22),
    [breakpoints.up("lg")]: {
      marginBottom: typography.pxToRem(44),
      marginTop: typography.pxToRem(80),
    },
  },
  section: {},
}));

function Hero({
  criteria,
  name,
  position,
  promisesByStatuses,
  title,
  ...props
}) {
  const classes = useStyles(props);

  return (
    <div className={classes.root}>
      <Section classes={{ root: classes.section }}>
        <Grid container direction="row" justify="space-between">
          <Hidden lgUp>
            <Grid item xs={12}>
              <Typography variant="h1">{name}</Typography>
            </Grid>
          </Hidden>
          <Grid item xs={12} lg={4}>
            <Profile name={name} title={title} date="Updated June 16, 2020" />
          </Grid>
          <Grid item xs={12} lg={8}>
            <ProfileChart
              promisesByStatuses={promisesByStatuses}
              criteria={criteria}
              name={name}
              position={position}
            />
          </Grid>
        </Grid>
      </Section>
    </div>
  );
}

Hero.propTypes = {
  criteria: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.shape({})),
    title: PropTypes.string.isRequired,
  }),
  name: PropTypes.string.isRequired,
  position: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  promisesByStatuses: PropTypes.arrayOf(PropTypes.shape({})),
};

Hero.defaultProps = {
  criteria: undefined,
  promisesByStatuses: undefined,
};

export default Hero;
