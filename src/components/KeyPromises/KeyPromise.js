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
  image,
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
          events={[
            { year: 2017, label: "Event A", color: "white" },
            { year: 2015, label: "Event B", color: "white" },
            {
              year: 2013,
              label: status.title,
              color: status.color,
              isCurrent: true,
            },
          ]}
        />
      </Grid>
    </Grid>
  );
}

KeyPromise.propTypes = {
  actionLabel: PropTypes.string,
  date: PropTypes.string.isRequired,
  description: PropTypes.string,
  image: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  status: PropTypes.shape({
    title: PropTypes.string,
    color: PropTypes.string,
  }),
};

KeyPromise.defaultProps = {
  actionLabel: undefined,
  description: undefined,
  status: undefined,
};

export default KeyPromise;
