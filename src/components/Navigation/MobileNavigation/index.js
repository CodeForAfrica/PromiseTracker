import React from "react";

import classNames from "classnames";

import { makeStyles } from "@material-ui/core/styles";

import {
  Grid,
  Slide,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  Link,
  Typography,
} from "@material-ui/core";

import SearchIcon from "@material-ui/icons/Search";
import CloseIcon from "@material-ui/icons/Close";
import MenuIcon from "@material-ui/icons/Menu";

import IconButtonLink from "components/Link/IconButton";

import Logo from "@/promisetracker/components/Navigation/Logo";
import NavigationList from "@/promisetracker/components/Navigation/MobileNavigation/NavigationList";

import config from "@/promisetracker/config";

const useStyles = makeStyles(() => ({
  dialog: {},
  dialogActions: {
    padding: "8px 24px",
    transform: "matrix(-1, 0, 0, -1, 0, 0, )",
    background:
      "transparent linear-gradient(360deg, #202020 0%, #005DFD 100%) 0% 0% no-repeat padding-box",
  },
  dialogContent: {
    backgroundColor: "#005DFD",
  },
  menuIcon: {
    color: "#202020",
  },
  searchIcon: {
    color: "#D6D6D6",
  },
  button: {
    color: "white",
    padding: "1rem",
  },
  languageButton: {
    fontWeight: 700,
    lineHeight: 1.875,
    minWidth: "1.5rem",
    opacity: 0.5,
    "&.active": {
      opacity: 1.0,
    },
  },
}));

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="left" ref={ref} {...props} />;
});

function MobileNavigation(props) {
  const classes = useStyles(props);
  const [open, setOpen] = React.useState(false);
  const { navigationMenu } = config;

  const handleClickOpen = (e) => {
    if (e) {
      e.preventDefault();
    }
    setOpen(true);
  };
  const handleClose = (e) => {
    if (e) {
      e.preventDefault();
    }
    setOpen(false);
  };

  return (
    <Grid container justify="space-between" alignItems="center">
      <Grid item>
        <Logo />
      </Grid>
      <Grid item>
        <IconButtonLink
          aria-label="Open drawer"
          color="secondary"
          edge="start"
          href="/#"
          className={classes.searchIcon}
        >
          <SearchIcon fontSize="large" />
        </IconButtonLink>

        <IconButtonLink
          aria-label="Open drawer"
          edge="start"
          href="/#"
          onClick={handleClickOpen}
          className={classes.menuIcon}
        >
          <MenuIcon fontSize="large" />
        </IconButtonLink>

        <Dialog
          fullScreen
          open={open}
          onClose={handleClose}
          TransitionComponent={Transition}
          classes={{ root: classes.dialog, paper: classes.dialogPaper }}
        >
          <DialogActions className={classes.dialogActions}>
            <Grid
              container
              justify="space-between"
              alignItems="center"
              spacing={1}
            >
              <Grid item>
                <Link
                  href="/#"
                  variant="overline"
                  underline="none"
                  className={classNames(
                    classes.button,
                    classes.languageButton,
                    "active"
                  )}
                >
                  En
                </Link>
                <Link
                  href="/#"
                  variant="overline"
                  underline="none"
                  className={classNames(classes.button, classes.languageButton)}
                >
                  Fr
                </Link>
                <Link
                  href="/#"
                  variant="overline"
                  underline="none"
                  className={classNames(classes.button, classes.languageButton)}
                >
                  عربى
                </Link>
              </Grid>
            </Grid>

            <Grid item>
              <IconButton
                aria-label="close drawer"
                edge="start"
                onClick={handleClose}
                className={classes.button}
              >
                <CloseIcon fontSize="large" />
              </IconButton>
            </Grid>
          </DialogActions>
          <DialogContent className={classes.dialogContent}>
            <Typography variant="body2" style={{ color: "white" }}>
              <NavigationList navigation={navigationMenu} />
            </Typography>
          </DialogContent>
        </Dialog>
      </Grid>
    </Grid>
  );
}

export default MobileNavigation;
