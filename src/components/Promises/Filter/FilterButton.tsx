import { Button, Typography } from "@mui/material";
import React from "react";
interface Props {
  name?: string;
  slug: string;
  active?: boolean;
  onClick?: (slug: string) => void;
}
function FilterButton({ active: activeProp, name, slug, onClick }: Props) {
  const handleClick = () => {
    if (onClick) {
      onClick(slug);
    }
  };

  return (
    <Button
      onClick={handleClick}
      variant={activeProp ? "contained" : "outlined"}
      sx={({ palette }) => ({
        border: `.122rem solid ${palette.primary.dark}`,
        marginRight: ".6rem",
        marginBottom: ".6rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "&:hover": {
          marginRight: ".6rem",
          marginBottom: ".6rem",
          border: `.122rem solid ${palette.primary.dark}`,
        },
        "&.MuiButton-contained": { backgroundColor: palette.primary.dark },
      })}
    >
      <Typography
        variant="h6"
        sx={{
          fontSize: 9.6,
          lineHeight: 2,
        }}
      >
        {name}
      </Typography>
    </Button>
  );
}

export default FilterButton;
