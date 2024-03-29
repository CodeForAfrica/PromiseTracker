import { Grid } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import PropTypes from "prop-types";
import React from "react";

import ProgressChart from "@/promisetracker/components/Hero/ProfileChart/MobileChart/ProgressChart";

const useStyles = makeStyles(() => ({
  root: {
    padding: "2rem 0rem",
  },
  chartGrid: {
    paddingLeft: "1rem",
  },
}));

function MobileChart({ promisesByStatus, ...props }) {
  const classes = useStyles(props);

  return (
    <Grid
      container
      direction="column"
      item
      xs={12}
      justify="flex-start"
      alignItems="flex-start"
      spacing={3}
      className={classes.root}
    >
      <ProgressChart
        totalPromises={promisesByStatus.count}
        color="#005DFD"
        borderRight="1px solid #005DFD"
        caption="Promise kept"
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

      <ProgressChart
        totalPromises={promisesByStatus.count}
        color="#909090"
        borderRight="1px solid #909090"
        caption="Uncertain"
        progressStatuses={[
          {
            color: "#909090",
            count: promisesByStatus.statusHistory.Inconclusive?.length,
            title: "Inconclusive",
          },
          {
            color: "#EBEBEB",
            count: promisesByStatus.statusHistory.Unstarted?.length,
            title: "Unstarted",
          },
        ]}
      />

      <ProgressChart
        totalPromises={promisesByStatus.count}
        color="#FF5255"
        borderRight="1px solid #FF5255"
        caption="Promise not kept"
        progressStatuses={[
          {
            color: "#FFB322",
            count: promisesByStatus.statusHistory["Behind Schedule"]?.length,
            title: "Behind Schedule",
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

MobileChart.propTypes = {
  promisesByStatus: PropTypes.shape({
    count: PropTypes.number,
    statusHistory: PropTypes.PropTypes.shape({
      "In Progress": PropTypes.arrayOf(PropTypes.shape({})),
      Completed: PropTypes.arrayOf(PropTypes.shape({})),
      Inconclusive: PropTypes.arrayOf(PropTypes.shape({})),
      Unstarted: PropTypes.arrayOf(PropTypes.shape({})),
      Stalled: PropTypes.arrayOf(PropTypes.shape({})),
      "Behind Schedule": PropTypes.arrayOf(PropTypes.shape({})),
    }),
  }),
};

MobileChart.defaultProps = {
  promisesByStatus: undefined,
};

export default MobileChart;
