import { Button, Theme, Typography } from "@mui/material";
import React from "react";

interface Props {
  name?: string;
  slug: string;
  onClick?: (slug: string) => void;
  active?: boolean;
}

function Sort({ name, onClick, slug, active, ...props }: Props) {
  const handleClick = () => {
    if (onClick) {
      onClick(slug);
    }
  };

  const buttonSx = (theme: Theme) => ({
    marginRight: ".5rem",
    marginBottom: 0,
    paddingBottom: 0,
    paddingLeft: "0rem",
    paddingRight: "0rem",
    display: "flex",
    alignItems: "start",
    justifyContent: "start",
    fontSize: "0.5rem",
    lineHeight: "12px",
    minWidth: 0,
    borderBottom: `1px solid ${active ? theme.palette.primary.dark : "transparent"}`,
  });
  const nameSx = {
    lineHeight: "1.4",
  };

  return (
    <Button
      key={slug}
      onClick={handleClick}
      variant="text"
      disableFocusRipple
      sx={buttonSx}
      {...props}
    >
      <Typography variant="h6" sx={nameSx}>
        {name?.replace(/([a-z])([A-Z])/g, "$1 $2")}
      </Typography>
    </Button>
  );
}

export default Sort;
