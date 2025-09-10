"use client";

import React, { useState } from "react";
import { Paper, InputBase, IconButton } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

type Props = {
  ariaLabel?: string;
  placeholder?: string;
  onChange?: (term: string) => void;
  onSearch?: (term: string) => void;
};

export default function Search({
  ariaLabel = "",
  placeholder = "SEARCH",
  onChange,
  onSearch,
  ...rest
}: Props) {
  const [term, setTerm] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTerm(e.target.value);
    onChange?.(e.target.value);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onSearch?.(term);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSearch?.(term);
    }
  };

  return (
    <Paper
      component="form"
      elevation={0}
      sx={{
        alignItems: "center",
        backgroundColor: "#EEEEEE",
        borderRadius: 0,
        display: "flex",
        width: "100%",
      }}
    >
      <InputBase
        inputProps={{ "aria-label": ariaLabel }}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        sx={(theme) => ({
          color: theme.palette.primary.main,
          flex: 1,
          padding: "0rem 2rem",
          fontSize: theme.typography.pxToRem(14),
          fontFamily: theme.typography.fontFamily,
          fontWeight: 500,
          "&: MuiInputBase-input": {
            flex: 1,
          },
        })}
        {...rest}
      />
      <IconButton
        aria-label="search"
        onClick={handleClick}
        sx={(theme) => ({
          p: {
            lg: theme.typography.pxToRem(1),
          },
          "&:hover": { backgroundColor: "transparent" },
        })}
        size="large"
      >
        <SearchIcon
          sx={(theme) => ({
            color: "#000",
            "&:hover": {
              backgroundColor: "unset",
            },
            padding: {
              lg: theme.typography.pxToRem(10),
            },
          })}
        />
      </IconButton>
    </Paper>
  );
}
