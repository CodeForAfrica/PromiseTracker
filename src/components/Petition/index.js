import { Section, RichTypography } from "@commons-ui/core";
import { Grid, Hidden, LinearProgress, Typography } from "@material-ui/core";
import PropTypes from "prop-types";
import React from "react";

import useStyles from "./useStyles";

import CtAButton from "@/promisetracker/components/CtAButton";
import Status from "@/promisetracker/components/PromiseStatus";
import SignPetition from "@/promisetracker/components/SignPetition";
import Share from "./ShareCard";

// replace
const petition = {
  image:
    "http://dashboard.hurumap.org/promisetracker/wp-content/uploads/sites/2/2021/08/adeboro-odunlami-bJgTryACMF0-unsplash.jpg",
  status: {
    name: "Closed",
    description: "",
    title: "Closed",
    color: "#EBEBEB",
  },
};

function Petition({ petitionPost }) {
  const {
    title,
    description,
    signatures,
    number_of_signatures_required: requiredSignatures,
    owner,
  } = petitionPost;
  const classes = useStyles({ image: petition.image });

  const { name } = owner;

  const signaturesData = [
    { name: "Gertrude", time: 4 },
    { name: "Brenda", time: 6 },
    { name: "Obed", time: 8 },
  ];

  return (
    <Section classes={{ root: classes.section }}>
      <Grid container>
        <Grid item xs={12} lg={8}>
          <RichTypography variant="h1" className={classes.promiseTitle}>
            {title}
          </RichTypography>
          <div className={classes.featuredImageContainer} />
          <RichTypography className={classes.owner}>
            <span>{name}</span> started this petition
          </RichTypography>
          {/* <ActNowCard {...props} /> */}
          <Hidden lgUp implementation="css">
            <div className={classes.mobileStatusContainer}>
              <Grid item className={classes.mobileStatusLabelGrid}>
                <RichTypography variant="h5" className={classes.statusLabel}>
                  Promise rating status:
                </RichTypography>
                <Status
                  {...petition.status}
                  classes={{ root: classes.mobileStatus }}
                />
              </Grid>
            </div>
          </Hidden>
          <RichTypography className={classes.promiseBody} variant="body1">
            {description}
          </RichTypography>
          <Grid container className={classes.petitionContainer}>
            <Grid item lg={6} justify="center">
              <Typography variant="h3" className={classes.petitionTitle}>
                Start your petiton now
              </Typography>
            </Grid>
            <Grid item lg={6} justify="center">
              <CtAButton
                color="secondary"
                classes={{
                  root: classes.cardButtonRoot,
                  button: classes.cardButton,
                }}
              >
                Start a new Petition
              </CtAButton>
            </Grid>
          </Grid>
        </Grid>
        <Grid item md={1} implementation="css" smDown component={Hidden} />
        <Hidden mdDown>
          <Grid item xs={12} lg={3}>
            <RichTypography variant="h4" className={classes.statusLabel}>
              Promise rating status:
            </RichTypography>
            <Status {...petition.status} classes={{ root: classes.status }} />
            <RichTypography className={classes.label} variant="h4">
              <span>{signatures.length}</span> have signed, let us get to{" "}
              {requiredSignatures}
            </RichTypography>
            <LinearProgress
              value={signatures.length}
              valueBuffer={requiredSignatures}
              variant="determinate"
              className={classes.progressBar}
              classes={{ barColorPrimary: classes.barColor }}
            />
            <div className={classes.petition}>
              {signaturesData && <SignPetition signatures={signaturesData} />}
            </div>
            <Share />
          </Grid>
        </Hidden>
      </Grid>
    </Section>
  );
}

Petition.propTypes = {
  petitionPost: PropTypes.shape({
    description: PropTypes.string,
    title: PropTypes.string,
    signatures: PropTypes.arrayOf(PropTypes.string),
    number_of_signatures_required: PropTypes.number,
    owner: PropTypes.shape({
      name: PropTypes.string,
    }),
  }),
};

Petition.defaultProps = {
  petitionPost: undefined,
};

export default Petition;
