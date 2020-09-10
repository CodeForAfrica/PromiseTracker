import React, { useState } from "react";
import PropTypes from "prop-types";

import { makeStyles } from "@material-ui/core/styles";
import { IconButton, InputBase, Paper } from "@material-ui/core";
import { Search as SearchIcon } from "@material-ui/icons";

const useStyles = makeStyles(({ breakpoints, typography }) => ({
  root: {
    alignItems: "center",
    backgroundColor: "#EEEEEE",
    border: "1px solid #9D9C9C",
    borderRadius: 10,
    boxShadow: "none",
    display: "flex",
    width: "100%",
  },
  input: {
    color: "#9D9C9C",
    flex: 1,
    fontSize: typography.pxToRem(20),
  },
  inputInput: {
    flex: 1,
    [breakpoints.up("md")]: {
      paddingBottom: typography.pxToRem(7),
      paddingLeft: typography.pxToRem(9),
      paddingRight: typography.pxToRem(9),
      paddingTop: typography.pxToRem(7),
    },
    [breakpoints.up("xl")]: {
      paddingBottom: typography.pxToRem(15),
      paddingLeft: typography.pxToRem(19),
      paddingRight: typography.pxToRem(19),
      paddingTop: typography.pxToRem(13),
    },
  },
  iconButton: {
    color: "#9D9C9C",
    [breakpoints.up("md")]: {
      paddingBottom: 0,
      paddingTop: 0,
    },
    [breakpoints.up("xl")]: {
      paddingBottom: `${typography.pxToRem(7)}`,
      paddingTop: `${typography.pxToRem(7)}`,
    },
  },
}));

function Search({ ariaLabel, onClick, onChange, placeholder, ...props }) {
  const classes = useStyles(props);
  const [term, setTerm] = useState();
  const handleChange = (e) => {
    setTerm(e.target.value);
    if (onChange) {
      onChange(e);
    }
  };
  const handleClick = (e) => {
    if (onClick) {
      const ev = e;
      ev.target.value = term;
      onClick(ev);
    }
  };
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      // Do code here
      e.preventDefault();
      if (onClick) {
        onClick(e);
      }
    }
  };

  return (
    <Paper component="form" className={classes.root}>
      <InputBase
        inputProps={{ "aria-label": ariaLabel }}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        classes={{
          root: classes.input,
          input: classes.inputInput,
        }}
        {...props}
      />
      <IconButton
        onClick={handleClick}
        className={classes.iconButton}
        aria-label="search"
      >
        <SearchIcon style={{ fontSize: 42 }} />
      </IconButton>
    </Paper>
  );
}

Search.propTypes = {
  ariaLabel: PropTypes.string,
  placeholder: PropTypes.string,
  onClick: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
};

Search.defaultProps = {
  ariaLabel: "",
  placeholder: "SEARCH",
};
export default Search;
