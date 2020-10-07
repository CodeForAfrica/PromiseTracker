import React from "react";

import PropTypes from "prop-types";

import { makeStyles } from "@material-ui/core/styles";
import { Grid, Typography } from "@material-ui/core";

import profilePic from "@/promisetracker/assets/hero-sonko.png";

const useStyles = makeStyles(({ breakpoints, palette }) => ({
  root: {
    [breakpoints.up("lg")]: {
      marginLeft: "-5rem",
    },
  },
  caption: {
    color: "#20202059",
  },
  img: {
    width: "149px",
    height: "149px",
    [breakpoints.up("lg")]: {
      width: "100%",
      height: "auto",
    },
  },
  subtitle: {
    color: palette.primary.main,
    textTransform: "uppercase",
  },
  typography: {
    textAlign: "center",
  },
}));

function Profile({ subtitle, name, date, ...props }) {
  const classes = useStyles(props);
  return (
    <Grid
      container
      direction="row"
      alignItems="center"
      item
      xs={12}
      md={10}
      lg={4}
      className={classes.root}
    >
      <Grid item xs={6} md={6} lg={12}>
        <img src={profilePic} alt="Profile" className={classes.img} />
      </Grid>
      <Grid item xs={6} lg={12}>
        <Typography variant="h5" className={classes.subtitle}>
          {subtitle}
        </Typography>
        <Typography variant="h6" className={classes.caption}>
          {date}
        </Typography>
      </Grid>
    </Grid>
  );
}

Profile.propTypes = {
  subtitle: PropTypes.string.isRequired,
  date: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
};
export default Profile;
