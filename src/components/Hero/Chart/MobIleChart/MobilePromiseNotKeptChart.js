import React from "react";

import PropTypes from "prop-types";

import { Grid, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import MobileSvgChart from "@/promisetracker/components/Hero/Chart/MobileChart/MobileSvgChart";

const useStyles = makeStyles(() => ({
  typo: {
    color: "#FF5255",
    fontStyle: "italic",
  },
  chartGrid: {
    paddingLeft: "1rem",
  },
  border: {
    borderLeft: "1px solid #FF5255",
  },
}));

function MobilePromiseNotKeptChart({ name, ...props }) {
  const classes = useStyles(props);
  return (
    <Grid
      container
      item
      direction="row"
      justify="flex-start"
      alignItems="flex-start"
    >
      <Grid item xs={4}>
        <Typography variant="body2" className={classes.typo}>
          {name}
        </Typography>
      </Grid>
      <Grid
        container
        item
        xs={8}
        direction="column"
        justify="flex-start"
        alignItems="flex-start"
        className={classes.border}
      >
        <MobileSvgChart
          fill="#FFB322"
          stroke="1D1D1B"
          strokeWidth="1"
          statusNumber="130"
          statusPercentage="(25%)"
          status="Delayed"
        />
        <MobileSvgChart
          fill="#FF5255"
          stroke="1D1D1B"
          strokeWidth="1"
          statusNumber="90"
          statusPercentage="(18%)"
          status="Stalled"
        />
      </Grid>
    </Grid>
  );
}

MobilePromiseNotKeptChart.propTypes = {
  name: PropTypes.number,
};

MobilePromiseNotKeptChart.defaultProps = {
  name: undefined,
};

export default MobilePromiseNotKeptChart;
