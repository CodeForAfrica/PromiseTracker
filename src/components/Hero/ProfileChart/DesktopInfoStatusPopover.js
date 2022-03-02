import {
  IconButton,
  Dialog,
  DialogContent,
  Typography,
  DialogTitle as MuiDialogTitle,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import CloseIcon from "@material-ui/icons/Close";
import Image from "next/image";
import PropTypes from "prop-types";
import React from "react";

import info from "@/promisetracker/assets/hero-icon-info.svg";
import PromiseStatusList from "@/promisetracker/components/PromiseStatusList";

const useStyles = makeStyles(({ palette, typography }) => ({
  iconGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "space-between",
  },
  infoIcon: {},
  iconButton: {},
  closeButton: {
    position: "absolute",
    right: "1rem",
    top: 10,
    color: palette.secondary.main,
  },
  paper: {
    position: "absolute",
    top: "15rem",
    // Make it higher than any other component on the page
    zIndex: 1,
    left: "46rem",
    height: "32.5rem",
    overflowY: "auto",
    width: "41.5rem",
  },
  container: {
    background: "#fafafa",
  },
  paperTitle: {
    padding: "1.5rem",
  },
  dialogContent: {
    padding: "1rem 2rem",
  },
  typo: {
    color: palette.primary.main,
  },
  description: {
    fontSize: typography.pxToRem(13),
  },
}));
function DialogTitle({ children, onClose, ...other }) {
  const classes = useStyles();

  return (
    <MuiDialogTitle
      disableTypography
      classes={{ root: classes.dialogContent }}
      {...other}
    >
      <Typography variant="h5" className={classes.title}>
        {children}
      </Typography>
      {onClose ? (
        <IconButton
          disableRipple
          disableFocusRipple
          aria-label="close"
          className={classes.closeButton}
          onClick={onClose}
        >
          <CloseIcon />
        </IconButton>
      ) : null}
    </MuiDialogTitle>
  );
}

DialogTitle.propTypes = {
  children: PropTypes.node.isRequired,
  onClose: PropTypes.func.isRequired,
};

function DesktopInfoStatusPopover({ items, title, ...props }) {
  const classes = useStyles(props);
  const [open, setOpen] = React.useState(false);
  const handleChange = () => {
    setOpen((prev) => !prev);
  };
  const handleClose = () => {
    setOpen(false);
  };

  if (!(title?.length || items?.length)) {
    return null;
  }
  return (
    <div>
      <IconButton
        disableRipple
        disableFocusRipple
        aria-label="Info"
        size="small"
        open={open}
        onClick={handleChange}
        className={classes.iconButton}
      >
        <Image src={info} alt="Info" className={classes.infoIcon} />
      </IconButton>

      <Dialog
        aria-labelledby="promise-ratings"
        onClose={handleClose}
        open={open}
        scroll="paper"
        classes={{
          root: classes.root,
          paper: classes.paper,
          container: classes.container,
        }}
      >
        {title && (
          <DialogTitle id="promise-ratings" onClose={handleClose}>
            {title}
          </DialogTitle>
        )}
        {items?.length && (
          <DialogContent classes={{ root: classes.dialogContent }}>
            <PromiseStatusList
              items={items}
              classes={{ description: classes.description }}
            />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

DesktopInfoStatusPopover.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      description: PropTypes.string,
    })
  ),
  title: PropTypes.string,
};

DesktopInfoStatusPopover.defaultProps = {
  items: undefined,
  title: undefined,
};

export default DesktopInfoStatusPopover;
