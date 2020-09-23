import React from "react";

import PropTypes from "prop-types";

import { Grid, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import SvgChart from "@/promisetracker/components/Hero/Chart/DesktopChart/SvgChart";

const useStyles = makeStyles(() => ({
  typo: {
    textAlign: "center",
    borderBottom: "2px solid #909090",
  },
  caption: {
    color: "#909090",
  },
  circleContainer: {
    display: "flex",
    flexDirection: "row",
    padding: "2rem 0rem",
  },
}));

function UncertainChart({ name, ...props }) {
  const classes = useStyles(props);
  return (
    <Grid item xs={4}>
      <div className={classes.typo}>
        <Typography variant="caption" className={classes.caption}>
          {name}
        </Typography>
      </div>
      <div className={classes.circleContainer}>
        <SvgChart
          width="100"
          height="100"
          cx="45"
          cy="45"
          radius="25"
          fill="#909090"
          stroke="#1D1D1B"
          strokeWidth="1"
          statusNumber="35"
          status="Inconclusive"
          statusPercentage="60%"
        />
        <SvgChart
          width="100"
          height="100"
          cx="45"
          cy="45"
          radius="15"
          fill="#EBEBEB"
          stroke="#1D1D1B"
          strokeWidth="1"
          statusNumber="50"
          status="Unstarted"
          statusPercentage="25%"
        />
      </div>
    </Grid>
  );
}

UncertainChart.propTypes = {
  name: PropTypes.number,
};

UncertainChart.defaultProps = {
  name: undefined,
};

export default UncertainChart;
