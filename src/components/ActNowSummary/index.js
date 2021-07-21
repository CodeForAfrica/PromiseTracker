import { Grid, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import PropTypes from "prop-types";
import React from "react";

const useStyles = makeStyles(() => ({
  root: {
    display: "flex",
    textAlign: "left",
    backgroundColor: "#F7F7F7",
    padding: "1rem",
  },
  count: {
    fontSize: "1.2rem",
    fontWeight: 600,
  },
}));

function ActNowSummary({ className, actNow, ...props }) {
  const { summary } = actNow;
  const classes = useStyles(props);
  return (
    <Grid container className={classes.root}>
      <Grid item xs={2}>
        <Typography variant="h4" className={classes.count}>
          {summary.accounts.count}
        </Typography>
      </Grid>
      <Grid item xs={3}>
        <Typography variant="body2">REGISTERED CITIZENS</Typography>
      </Grid>
      <Grid item xs={3}>
        <Typography variant="h4" className={classes.count}>
          {summary.petitions.count}
        </Typography>
      </Grid>
      <Grid item xs={2}>
        <Typography variant="body2">PETITIONS</Typography>
      </Grid>
    </Grid>
  );
}

ActNowSummary.propTypes = {
  className: PropTypes.string,
  actNow: PropTypes.shape,
};

ActNowSummary.defaultProps = {
  className: undefined,
  actNow: undefined,
};

export default ActNowSummary;
