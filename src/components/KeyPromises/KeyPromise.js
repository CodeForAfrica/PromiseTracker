import React from "react";
import PropTypes from "prop-types";

import { Grid, useMediaQuery } from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";

import { RichTypography } from "@commons-ui/core";

import CtAButton from "@/promisetracker/components/CtAButton";
import PromiseTimeline from "@/promisetracker/components/PromiseTimeline";

import useStyles from "./useStyles";

function KeyPromise({
  actionLabel,
  description,
  events,
  image,
  date,
  statuses,
  status,
  title,
  ...props
}) {
  const classes = useStyles(props);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const titleVariant = isDesktop ? "h2" : "h3";

  return (
    <Grid
      container
      justify="space-between"
      alignItems="stretch"
      className={classes.keyPromise}
    >
      <Grid item xs={12} lg={5} className={classes.keyPromiseMediaGrid}>
        <div className={classes.mediaContainer}>
          <img src={image} alt={title} className={classes.media} />
        </div>
      </Grid>
      <Grid
        item
        xs={12}
        lg={6}
        container
        direction="column"
        justify="space-between"
        alignContent="stretch"
        className={classes.keyPromiseDetailsGrid}
      >
        <Grid item>
          <RichTypography
            variant={titleVariant}
            className={classes.keyPromiseTitle}
          >
            {title}
          </RichTypography>
          {isDesktop && (
            <RichTypography
              variant="body2"
              className={classes.keyPromiseDescription}
            >
              {description}
            </RichTypography>
          )}
        </Grid>
        {actionLabel && (
          <CtAButton
            color="primary"
            classes={{
              root: classes.keyPromiseCta,
              button: classes.keyPromiseCtaButton,
            }}
          >
            {actionLabel}
          </CtAButton>
        )}
      </Grid>
      <Grid className={classes.timelineGrid} item xs={12}>
        <PromiseTimeline
          events={events}
          date={date}
          status={status}
          statuses={statuses}
          classes={{ root: classes.timeline }}
        />
      </Grid>
    </Grid>
  );
}

KeyPromise.propTypes = {
  actionLabel: PropTypes.string,
  date: PropTypes.string.isRequired,
  description: PropTypes.string,
  events: PropTypes.arrayOf(PropTypes.shape({})),
  image: PropTypes.string.isRequired,
  statuses: PropTypes.arrayOf(PropTypes.shape({})),
  status: PropTypes.shape({}),
  title: PropTypes.string.isRequired,
};

KeyPromise.defaultProps = {
  actionLabel: undefined,
  description: undefined,
  events: undefined,
  statuses: undefined,
  status: undefined,
};

export default KeyPromise;
