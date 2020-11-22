import React, { useState } from "react";
import PropTypes from "prop-types";

import { Typography, Grid } from "@material-ui/core";
import { Section } from "@commons-ui/core";

import TextField from "@material-ui/core/TextField";
import Autocomplete from "@material-ui/lab/Autocomplete";

import CtAButton from "@/promisetracker/components/CtAButton";
import FormDialog from "@/promisetracker/components/FormDialog";

import useStyles from "./useStyles";

function PickPromise({ promises, ...props }) {
  const classes = useStyles(props);
  const [open, setOpen] = useState(false);

  const handleFormOpen = () => {
    setOpen(true);
  };

  const handleFormClose = () => {
    setOpen(false);
  };

  const {
    pickPromiseTitle,
    pickPromiseDescription,
    mandatoryText,
    petitionStart,
    petitionJoin,
  } = props;

  return (
    <div className={classes.root}>
      <Section classes={{ root: classes.section }}>
        <Grid container>
          <Grid item xs={12}>
            <Typography className={classes.title} variant="body1">
              {pickPromiseTitle}
            </Typography>
            <Typography variant="body2" className={classes.textContent}>
              {pickPromiseDescription}
            </Typography>
            <Autocomplete
              classes={{
                endAdornment: classes.endAdornment,
                popupIndicator: classes.popUpIndicator,
                clearIndicator: classes.clearIndicator,
              }}
              options={promises || []}
              autoHighlight
              getOptionLabel={(option) => option.title}
              renderOption={(option) => (
                <>
                  <span>{option.title}</span>
                </>
              )}
              style={{ width: 400 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="No Promises Selected"
                  variant="outlined"
                />
              )}
            />
            <Typography variant="body2" className={classes.textContent}>
              {mandatoryText}
            </Typography>
          </Grid>
          <Grid item xs={12} className={classes.buttonContainer}>
            <CtAButton
              color="secondary"
              onClick={handleFormOpen}
              classes={{
                root: classes.cta,
                button: classes.ctaButton,
              }}
            >
              {petitionStart}
            </CtAButton>
            <CtAButton
              color="secondary"
              classes={{
                root: classes.cta,
                button: classes.ctaButton,
              }}
            >
              {petitionJoin}
            </CtAButton>
            <FormDialog open={open} handleFormClose={handleFormClose} />
          </Grid>
        </Grid>
      </Section>
    </div>
  );
}

PickPromise.propTypes = {
  promises: PropTypes.arrayOf(PropTypes.shape({})),
  pickPromiseTitle: PropTypes.string,
  pickPromiseDescription: PropTypes.string,
  mandatoryText: PropTypes.string,
  petitionStart: PropTypes.string,
  petitionJoin: PropTypes.string,
};

PickPromise.defaultProps = {
  promises: null,
  pickPromiseTitle: null,
  pickPromiseDescription: null,
  mandatoryText: null,
  petitionStart: null,
  petitionJoin: null,
};

export default PickPromise;
