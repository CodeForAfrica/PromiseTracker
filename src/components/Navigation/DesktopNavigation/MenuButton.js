import React, { useRef } from "react";
import PropTypes from "prop-types";

import { Typography } from "@material-ui/core";

import LinkButton from "@/promisetracker/components/Link/Button";

import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(() => ({
  button: {
    border: 0,
    "&:hover": {
      border: 0,
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
      <Typography variant="h4">{title}</Typography>
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
