import React, { useRef } from "react";
import PropTypes from "prop-types";
import LinkButton from "@/promisetracker/components/Link/Button";

import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(({ palette, typography }) => ({
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

function MenuButton({ size, href, title, ...props }) {
  const classes = useStyles(props);
  const buttonRef = useRef();

  return (
    <LinkButton
      disableFocusRipple
      disableRipple
      size={size}
      href={href}
      {...props}
      variant="outlined"
      ref={buttonRef}
      className={classes.button}
    >
      {title}
    </LinkButton>
  );
}

MenuButton.propTypes = {
  size: PropTypes.string,
  title: PropTypes.string,
  href: PropTypes.string,
};

MenuButton.defaultProps = {
  size: undefined,
  title: undefined,
  href: undefined,
};

export default MenuButton;
