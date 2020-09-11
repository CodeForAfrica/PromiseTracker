import React, { useRef } from "react";
import PropTypes from "prop-types";

import { Button, Typography } from "@material-ui/core";
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
    <a href={href}>
      <Button
        disableFocusRipple
        disableRipple
        size={size}
        {...props}
        variant="outlined"
        ref={buttonRef}
        className={classes.button}
      >
        <Typography variant="h4">{title}</Typography>
      </Button>
    </a>
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
