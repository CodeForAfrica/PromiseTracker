import React from "react";
import PropTypes from "prop-types";

import { Grid, Divider } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import ProgressChart from "@/promisetracker/components/Hero/ProfileChart/DesktopChart/ProgressChart";

const useStyles = makeStyles(({ typography }) => ({
  root: {
    padding: "1.5rem 0rem",
    height: typography.pxToRem(284),
    maxHeight: "100%",
    width: "54.1875rem",
  },
  promiseGrid: {
    margin: "0.5rem",
  },
  circleContainer: {
    display: "flex",
    flexDirection: "row",
    padding: "2rem 0rem",
  },
  divider: {
    margin: "2rem 1rem 1rem 1rem",
    height: typography.pxToRem(200),
  },
}));

function DesktopChart({ promisesByStatus, ...props }) {
  const classes = useStyles(props);
  return (
    <Grid
      container
      item
      direction="row"
      justify="flex-start"
      className={classes.root}
    >
      <ProgressChart
        color="#145BD5"
        borderBottom="1px solid #145BD5"
        caption="Promise Kept"
        totalPromises={promisesByStatus.count}
        progressStatuses={[
          {
            color: "#005DFD",
            count: promisesByStatus.statusHistory.Completed?.length,
            title: "Completed",
          },
          {
            color: "#90DAFF",
            count: promisesByStatus.statusHistory["In Progress"]?.length,
            title: "In Progress",
          },
        ]}
      />
      <Divider orientation="vertical" className={classes.divider} />
      <ProgressChart
        color="#909090"
        borderBottom="1px solid #909090"
        caption="Uncertain"
        totalPromises={promisesByStatus.count}
        progressStatuses={[
          {
            color: "#909090",
            count: promisesByStatus.statusHistory.Unrated?.length,
            title: "Inconclusive",
          },
          {
            color: "#EBEBEB",
            count: promisesByStatus.statusHistory.Unstarted?.length,
            title: "Unstarted",
          },
        ]}
      />

      <Divider orientation="vertical" className={classes.divider} />
      <ProgressChart
        color="#FF5255"
        borderBottom="1px solid #FF5255"
        caption="Promise Not Kept"
        totalPromises={promisesByStatus.count}
        progressStatuses={[
          {
            color: "#FFB322",
            count: promisesByStatus.statusHistory.Delayed?.length,
            title: "Delayed",
          },
          {
            color: "#FF5154",
            count: promisesByStatus.statusHistory.Stalled?.length,
            title: "Stalled",
          },
        ]}
      />
    </Grid>
  );
}

DesktopChart.propTypes = {
  promisesByStatus: PropTypes.shape({
    count: PropTypes.number,
    statusHistory: PropTypes.PropTypes.shape({
      "In Progress": PropTypes.arrayOf(PropTypes.shape({})),
      Completed: PropTypes.arrayOf(PropTypes.shape({})),
      Unrated: PropTypes.arrayOf(PropTypes.shape({})),
      Unstarted: PropTypes.arrayOf(PropTypes.shape({})),
      Stalled: PropTypes.arrayOf(PropTypes.shape({})),
      Delayed: PropTypes.arrayOf(PropTypes.shape({})),
    }),
  }),
};

DesktopChart.defaultProps = {
  promisesByStatus: undefined,
};

export default DesktopChart;
