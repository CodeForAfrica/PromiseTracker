import { Button, Typography } from "@material-ui/core";
import PropTypes from "prop-types";
import React from "react";

import useStyles from "./useStyles";

function FilterButton({ active: activeProp, name, slug, onClick, ...props }) {
  const classes = useStyles(props);
  const handleClick = () => {
    if (onClick) {
      onClick(slug);
    }
  };

  return (
    <Button
      onClick={handleClick}
      variant={activeProp ? "contained" : "outlined"}
      className={classes.button}
    >
      <Typography variant="h6" className={classes.name}>
        {name}
      </Typography>
    </Button>
  );
}

FilterButton.propTypes = {
  active: PropTypes.bool,
  name: PropTypes.string,
  slug: PropTypes.string,
  onClick: PropTypes.func,
};

FilterButton.defaultProps = {
  active: undefined,
  name: undefined,
  slug: undefined,
  onClick: undefined,
};

export default FilterButton;
