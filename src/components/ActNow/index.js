import { Section } from "@commons-ui/core";
import { Grid, Typography, useMediaQuery } from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Head from "next/head";
import Image from "next/image";
import PropTypes from "prop-types";
import React from "react";

import actNowLogo from "@/promisetracker/assets/Component 121 – 1@2x.png";
import actNowImg from "@/promisetracker/assets/illo-aboutTheProject@2x.png";
import CtAButton from "@/promisetracker/components/CtAButton";

const useStyles = makeStyles(({ breakpoints, palette, typography }) => ({
  section: {},
  root: {
    backgroundColor: "#ebebeb",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: typography.pxToRem(53),
    paddingTop: typography.pxToRem(45),
  },
  title: {
    marginBottom: 0,
    marginTop: 0,
    width: "fit-content",
    "&:after": {
      borderBottom: `8px solid ${palette.text.primary}`,
      content: '""',
      position: "absolute",
      bottom: 0,
      left: 0,
      width: "100%",
    },
  },
  content: {
    alignItems: "center",
    flexDirection: "column-reverse",
    justifyContent: "center",
    [breakpoints.up("lg")]: {
      alignItems: "stretch",
      flexDirection: "row",
      justifyContent: "space-between",
    },
  },
  cta: {
    marginBottom: 0,
    marginTop: 0,
    [breakpoints.up("lg")]: {
      justifyContent: "left",
      padding: 0,
    },
  },
  ctaButton: {
    minWidth: typography.pxToRem(138),
    [breakpoints.up("lg")]: {
      minWidth: typography.pxToRem(158),
    },
  },
  description: {
    padding: "1rem 0rem 1.5rem 0rem",
    textAlign: "left",
    [breakpoints.up("lg")]: {
      lineHeight: "1.875rem",
    },
  },
  logoFigure: {
    height: typography.pxToRem(105.5),
    margin: 0,
    position: "relative",
    width: typography.pxToRem(208.36),
    [breakpoints.up("lg")]: {
      height: typography.pxToRem(140.63),
      width: typography.pxToRem(277.74),
    },
  },
  figure: {
    height: typography.pxToRem(272),
    margin: 0,
    position: "relative",
    width: typography.pxToRem(314),
    [breakpoints.up("lg")]: {
      height: typography.pxToRem(350),
      width: typography.pxToRem(440),
    },
  },
  image: {
    objectFit: "contain",
  },
  textContainer: {
    marginTop: typography.pxToRem(19),
    [breakpoints.up("lg")]: {
      marginTop: 0,
    },
  },
}));

function ActNow({ actionLabel, description, title, ...props }) {
  const classes = useStyles(props);
  const theme = useTheme();
  const descriptionVariant = useMediaQuery(theme.breakpoints.up("lg"))
    ? "body1"
    : "body2";

  return (
    <div className={classes.root}>
      <Head>
        <link key="act-now" rel="preload" href={actNowImg.src} as="image" />
      </Head>
      <Section classes={{ root: classes.section }}>
        <Grid container className={classes.content}>
          <Grid item xs={12} lg={6} container alignItems="center">
            <div className={classes.textContainer}>
              <figure className={classes.logoFigure}>
                <Image
                  src={actNowLogo}
                  layout="fill"
                  alt="actNOW"
                  className={classes.image}
                />
              </figure>
              <Typography
                variant={descriptionVariant}
                className={classes.description}
              >
                {description}
              </Typography>
              <CtAButton
                classes={{
                  root: classes.cta,
                  button: classes.ctaButton,
                }}
                href="/act-now"
              >
                {actionLabel}
              </CtAButton>
            </div>
          </Grid>
          <Grid item>
            <figure className={classes.figure}>
              <Image
                src={actNowImg}
                layout="fill"
                alt={actionLabel}
                className={classes.image}
              />
            </figure>
          </Grid>
        </Grid>
      </Section>
    </div>
  );
}
ActNow.propTypes = {
  actionLabel: PropTypes.string,
  description: PropTypes.string,
  title: PropTypes.string,
};

ActNow.defaultProps = {
  actionLabel: undefined,
  description: undefined,
  title: undefined,
};

export default ActNow;
