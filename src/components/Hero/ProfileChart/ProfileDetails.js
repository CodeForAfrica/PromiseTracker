import React, { useState } from "react";

import PropTypes from "prop-types";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Grid, IconButton, Typography, useMediaQuery } from "@material-ui/core";

import viz1 from "@/promisetracker/assets/hero-icon-viz1-onclick.svg";
import viz2 from "@/promisetracker/assets/hero-icon-viz2.svg";
import info from "@/promisetracker/assets/hero-icon-info.svg";
import share from "@/promisetracker/assets/hero-icon-share.svg";

import StatusListPopover from "@/promisetracker/components/Hero/ProfileChart/StatusListPopover";

import PromiseKeptChart from "@/promisetracker/components/Hero/ProfileChart/DesktopChart/PromiseKeptChart";
import UncertainChart from "@/promisetracker/components/Hero/ProfileChart/DesktopChart/UncertainChart";
import PromiseNotKeptChart from "@/promisetracker/components/Hero/ProfileChart/DesktopChart/PromiseNotKeptChart";
import MobileChart from "@/promisetracker/components/Hero/ProfileChart/MobileChart";
import DesktopChart from "@/promisetracker/components/Hero/ProfileChart/DesktopChart";

import MobilePromiseKeptChart from "@/promisetracker/components/Hero/ProfileChart/MobileChart/MobilePromiseKeptChart";
import MobilePromiseNotKeptChart from "@/promisetracker/components/Hero/ProfileChart/MobileChart/MobilePromiseNotKeptChart";
import MobileUncertainChart from "@/promisetracker/components/Hero/ProfileChart/MobileChart/MobileUncertainChart";

const useStyles = makeStyles(() => ({
  iconGrid: {
    display: "flex",
    flexDirection: "row",
  },
  iconButton: {
    background: "#F7F7F7",
    padding: "1.5rem",
    margin: "0.5rem",
  },
  img: {
    width: "100%",
    height: "auto",
  },
}));

function ProfileDetails({ name, ...props }) {
  const classes = useStyles(props);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const [clicked, setClicked] = useState();

  const handleOnClick = () => {
    setClicked(!clicked);
  };

  return (
    <>
      <Grid container direction="row" item spacing={3}>
        {isDesktop ? (
          <>
            <Grid item xs={8}>
              {isDesktop ? <Typography variant="h1">{name}</Typography> : null}
              <Typography variant="body2">
                Nairobi Governor Mike “Sonko” Mbuvi <b>510 promises </b>at a
                glance
              </Typography>
            </Grid>
            <Grid item xs={4} className={classes.iconGrid}>
              <IconButton
                disableRipple
                disableFocusRipple
                aria-label="Info"
                size="small"
                onClick={handleOnClick}
                className={classes.iconButton}
              >
                {clicked ? (
                  <img src={viz1} alt="Viz1" />
                ) : (
                  <img src={viz2} alt="Viz2" />
                )}
              </IconButton>
              <IconButton
                disableRipple
                disableFocusRipple
                aria-label="Info"
                size="small"
                className={classes.iconButton}
              >
                <img src={info} alt="Info" />
              </IconButton>
              <IconButton
                disableRipple
                disableFocusRipple
                aria-label="Share"
                size="small"
                className={classes.iconButton}
              >
                <img src={share} alt="Share" />
              </IconButton>
            </Grid>
          </>
        ) : (
          <>
            <Grid item xs={6}>
              <Typography variant="body2">
                Nairobi Governor Mike “Sonko” Mbuvi <b>510 promises </b>at a
                glance
              </Typography>
            </Grid>
            <Grid item xs={6} className={classes.iconGrid}>
              <StatusListPopover />
              <IconButton
                disableRipple
                disableFocusRipple
                aria-label="Share"
                size="small"
                className={classes.iconButton}
              >
                <img src={share} alt="Share" />
              </IconButton>
            </Grid>
          </>
        )}
      </Grid>
      <>
        {isDesktop ? (
          <DesktopChart style={{ position: "relative" }}>
            <PromiseKeptChart name="Promises Kept" />
            <UncertainChart name="Uncertain" />
            <PromiseNotKeptChart name="Promises Not Kept" />
          </DesktopChart>
        ) : (
          <MobileChart>
            <MobilePromiseKeptChart name="Promise Kept" />
            <MobileUncertainChart name="Uncertain" />
            <MobilePromiseNotKeptChart name="Promise Not Kept" />
          </MobileChart>
        )}
      </>
    </>
  );
}

ProfileDetails.propTypes = {
  name: PropTypes.string.isRequired,
};

export default ProfileDetails;
