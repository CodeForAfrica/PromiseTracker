import React from "react";
import PropTypes from "prop-types";

import {
  Dialog,
  IconButton,
  DialogTitle,
  DialogActions,
  DialogContent,
  DialogContentText,
  Typography,
} from "@material-ui/core";

import CtAButton from "@/promisetracker/components/CtAButton";
import CloseIcon from "@material-ui/icons/Close";
import UpdateForm from "./UpdateForm";
import useStyles from "./useStyles";

function FormDialog({
  open,
  handleFormClose,
  promise_act_now: promiseActNow,
  ...props
}) {
  const classes = useStyles(props);

  const {
    update: {
      update_title: updateTitle,
      update_description: updateDescription,
    },
  } = promiseActNow;

  return (
    <Dialog
      open={open}
      scroll="body"
      onClose={handleFormClose}
      aria-labelledby="form-dialog-title"
      aria-describedby="form-dialog-description"
      classes={{
        scrollBody: classes.scrollBody,
        paperScrollBody: classes.paperScrollBody,
        paperWidthSm: classes.paperWidthSm,
      }}
    >
      <DialogTitle
        disableTypography
        id="form-dialog-title"
        classes={{ root: classes.title }}
      >
        <Typography variant="h2">{updateTitle}</Typography>
        <IconButton
          disableRipple
          disableFocusRipple
          aria-label="close"
          onClick={handleFormClose}
        >
          <CloseIcon classes={{ root: classes.iconRoot }} />
        </IconButton>
      </DialogTitle>
      <DialogContent classes={{ root: classes.dialogContent }}>
        <DialogContentText
          id="form-dialog-description"
          classes={{ root: classes.description }}
        >
          {updateDescription}
        </DialogContentText>
        <UpdateForm promise_act_now={promiseActNow} {...props} />
      </DialogContent>
      <DialogActions>
        <CtAButton color="primary" onClick={handleFormClose}>
          Submit
        </CtAButton>
      </DialogActions>
    </Dialog>
  );
}

FormDialog.propTypes = {
  handleFormClose: PropTypes.func,
  open: PropTypes.bool,
  petitionDescription: PropTypes.string,
  petitionTitle: PropTypes.string,
  promise_act_now: PropTypes.shape({
    update: {
      updateTitle: PropTypes.string,
      updateDescription: PropTypes.string,
    },
  }),
};

FormDialog.defaultProps = {
  open: null,
  handleFormClose: null,
  petitionDescription: null,
  petitionTitle: null,
  promise_act_now: PropTypes.shape({
    update: {
      updateTitle: null,
      updateDescription: null,
    },
  }),
};

export default FormDialog;
