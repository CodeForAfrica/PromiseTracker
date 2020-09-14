import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

import {
  Box,
  Button,
  ClickAwayListener,
  Collapse,
  Popper,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(({ spacing, palette, typography }) => ({
  root: {
    display: "flex",
  },
  paper: {
    marginRight: spacing(2),
  },
  popper: {
    marginTop: typography.pxToRem(34),
    width: "100%",
    zIndex: 9999,
  },
  button: {
    border: 0,
    color: palette.primary.main,
    padding: "1.2rem",
    textTransform: "uppercase",
    fontFamily: typography.fontFamily,
    letterSpacing: "0.56px",
    fontWeight: 500,
    fontSize: typography.pxToRem(16),
    "&:hover": {
      border: 0,
    },
    "&.active": {
      backgroundColor: palette.primary.dark,
      color: "white",
      borderRadius: 0,
    },
  },
}));

function NavigationButton({
  active,
  anchorEl,
  button: buttonProp,
  children,
  open: openProp,
  onClose,
  popperProps,
  size,
  title,
  ...props
}) {
  const classes = useStyles(props);
  const buttonRef = useRef();
  const [open, setOpen] = useState();
  const handleToggleOpen = () => {
    setOpen((prevOpen) => !prevOpen);
  };
  const handleClose = (e) => {
    if (buttonRef.current && buttonRef.current.contains(e.target)) {
      return;
    }
    setOpen(false);
  };
  const button = buttonProp || (
    <Button
      onClick={handleToggleOpen}
      size={size}
      {...props}
      variant="outlined"
      ref={buttonRef}
      className={classes.button}
    >
      {title}
    </Button>
  );
  useEffect(() => {
    setOpen(openProp);
  }, [openProp]);

  return (
    <>
      {button}
      <Popper
        open={!active && open}
        anchorEl={anchorEl || buttonRef.current}
        role={undefined}
        transition
        disablePortal
        {...popperProps}
        className={classes.popper}
      >
        {({ TransitionProps }) => (
          <ClickAwayListener onClickAway={onClose || handleClose}>
            <Collapse {...TransitionProps}>
              {/* We need component that can forwardRef here */}
              <Box>{children}</Box>
            </Collapse>
          </ClickAwayListener>
        )}
      </Popper>
    </>
  );
}

NavigationButton.propTypes = {
  active: PropTypes.bool,
  anchorEl: PropTypes.shape({}),
  onClose: PropTypes.func,
  open: PropTypes.bool,
  popperProps: PropTypes.shape({}),
  button: PropTypes.shape({}),
  children: PropTypes.shape({}),
  title: PropTypes.string,
  size: PropTypes.string,
};

NavigationButton.defaultProps = {
  active: false,
  anchorEl: false,
  onClose: undefined,
  open: false,
  popperProps: undefined,
  button: undefined,
  title: undefined,
  size: undefined,
  children: undefined,
};
export default NavigationButton;
