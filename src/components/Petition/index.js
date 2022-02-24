import { Section, RichTypography } from "@commons-ui/core";
import {
  Grid,
  Hidden,
  LinearProgress,
  Typography,
  IconButton,
} from "@material-ui/core";
import UserIcon from "@material-ui/icons/Person";
import { useSession } from "next-auth/react";
import Router from "next/router";
import PropTypes from "prop-types";
import React, { useState } from "react";

import Share from "./ShareCard";
import useStyles from "./useStyles";

import CtAButton from "@/promisetracker/components/CtAButton";
import FormDialog from "@/promisetracker/components/FormDialog";
import Status from "@/promisetracker/components/PromiseStatus";
import SignPetition from "@/promisetracker/components/SignPetition";

function Petition({ petitionPost = {}, ...props }) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  const {
    title = "",
    description = "",
    image,
    signatures = [],
    number_of_signatures_required: requiredSignatures = 0,
    owner = "",
  } = petitionPost;

  const status = {
    name: requiredSignatures === signatures.length ? "Closed" : "Pending",
    description: "",
    title: "Closed",
    color: "#EBEBEB",
  };

  const classes = useStyles({ image });

  const handleFormOpen = () => {
    if (!session) {
      setOpen(false);
      Router.push("/act-now");
    } else {
      setOpen(true);
    }
  };

  const handleFormClose = () => {
    setOpen(false);
  };

  const { name } = owner;

  return (
    <Section classes={{ root: classes.section }}>
      <Grid container>
        <Grid item xs={12} lg={8}>
          {title && (
            <RichTypography variant="h1" className={classes.petitionTitle}>
              {title}
            </RichTypography>
          )}
          <div className={classes.featuredImageContainer} />
          <div className={classes.ownerSection}>
            <IconButton className={classes.usericonButton} color="primary">
              <UserIcon />
            </IconButton>
            {name && (
              <RichTypography className={classes.owner}>
                <span>{name}</span> started this petition
              </RichTypography>
            )}
          </div>
          <Hidden lgUp implementation="css">
            <div className={classes.mobileStatusContainer}>
              <Grid item className={classes.mobileStatusLabelGrid}>
                <RichTypography variant="h5" className={classes.statusLabel}>
                  Promise rating status:
                </RichTypography>
                <Status {...status} classes={{ root: classes.mobileStatus }} />
              </Grid>
            </div>
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
              {signatures && (
                <SignPetition signatures={signatures} session={session} />
              )}
            </div>
            <Share />
          </Hidden>
          {description && (
            <RichTypography className={classes.petitionBody} variant="body1">
              {description}
            </RichTypography>
          )}
          <Grid container className={classes.petitionContainer}>
            <Grid
              item
              lg={6}
              sm={6}
              xs={12}
              container
              justify="center"
              alignItems="center"
            >
              <Typography variant="h3">Start a petition of your own</Typography>
            </Grid>
            <Grid item lg={6} sm={6} xs={12} justify="center">
              <CtAButton
                color="secondary"
                onClick={handleFormOpen}
                classes={{
                  root: classes.cardButtonRoot,
                  button: classes.cardButton,
                }}
              >
                Start a new Petition
              </CtAButton>
              <FormDialog
                open={open}
                handleFormClose={handleFormClose}
                {...props}
              />
            </Grid>
          </Grid>
        </Grid>
        <Grid item md={1} implementation="css" smDown component={Hidden} />
        <Hidden mdDown>
          <Grid item xs={12} lg={3}>
            <RichTypography variant="h4" className={classes.statusLabel}>
              Promise rating status:
            </RichTypography>
            <Status {...status} classes={{ root: classes.status }} />
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
              {signatures && (
                <SignPetition signatures={signatures} session={session} />
              )}
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
    signatures: PropTypes.arrayOf(PropTypes.shape({})),
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
