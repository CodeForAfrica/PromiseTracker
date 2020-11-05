import React from "react";
import PropTypes from "prop-types";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { useMediaQuery } from "@material-ui/core";
import Labels from "./Labels";
import PromiseEvent from "./PromiseEvent";
import PromiseStatus from "./PromiseStatus";

const useStyles = makeStyles(() => ({
  root: {
    overflow: "visible",
  },
}));

function PromiseTimeline({ events, date, statuses, ...props }) {
  const classes = useStyles(props);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const interval = [new Date(date).getFullYear(), new Date().getFullYear() + 2];

  return (
    <svg width="100%" height="100" className={classes.root}>
      <rect
        x="8"
        y="69"
        width="99%"
        height="1"
        style={{
          fill: "#EBEBEB",
        }}
      />
      {isDesktop &&
        events?.map((event) => (
          <>
            <PromiseEvent key={event.label} interval={interval} {...event} />
          </>
        ))}
      {statuses?.map((status) => (
        <PromiseStatus key={status.title} interval={interval} {...status}>
          <rect
            x="8"
            y="69"
            width="99%"
            height="1"
            style={{
              fill: "#EBEBEB",
            }}
          />
        </PromiseStatus>
      ))}
      <Labels interval={interval} />
    </svg>
  );
}

PromiseTimeline.propTypes = {
  events: PropTypes.arrayOf(PropTypes.shape({})),
  date: PropTypes.string,
  statuses: PropTypes.arrayOf(PropTypes.shape({})),
};
PromiseTimeline.defaultProps = {
  date: undefined,
  events: undefined,
  statuses: undefined,
};

export default PromiseTimeline;
