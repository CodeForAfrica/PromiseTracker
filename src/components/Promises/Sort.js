import { Button, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import PropTypes from "prop-types";
import React from "react";

const useStyles = makeStyles(({ palette }) => ({
  root: {
    marginRight: ".5rem",
    marginBottom: 0,
    paddingBottom: 0,
    paddingLeft: "0rem",
    paddingRight: "0rem",
    /*  borderBottom: `.12rem solid ${palette.primary.dark}`, */
    display: "flex",
    alignItems: "start",
    justifyContent: "start",
    fonstSize: "0.5rem",
    lineHeight: "12px",
  },
  name: {
    borderBottom: `.12rem solid ${palette.primary.dark}`,
    lineHeight: "1.4",
  },
}));

function Sort({ name, onClick, slug, ...props }) {
  const classes = useStyles(props);
  const handleClick = () => {
    if (onClick) {
      onClick(slug);
    }
  };

  return (
    <Button
      key={slug}
      onClick={handleClick}
      variant="text"
      disableFocusRipple
      className={classes.root}
    >
      <Typography variant="h6" className={classes.name}>
        {name}
      </Typography>
    </Button>
  );
}

Sort.propTypes = {
  name: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  slug: PropTypes.string.isRequired,
};

Sort.defaultProps = {
  onClick: undefined,
};

export default Sort;
