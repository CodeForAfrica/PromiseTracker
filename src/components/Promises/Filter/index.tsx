import { Box, Typography } from "@mui/material";
import React from "react";

import Button from "./FilterButton";
import Sort from "@/components/Promises/Sort";

interface Props {
  label?: string;
  items: Array<{
    name: string;
    slug: string;
    active?: boolean;
  }>;
  onClick?: (slug: string) => void;
  variant?: "outlined" | "contained" | "text";
}
function Filter({ label, items, onClick, variant }: Props) {
  const rootSx = {
    mb: { xs: 1.5, lg: 0 },
    display: "flex",
    alignItems: "center",
    gap: 1,
  };
  const filterContainerSx = {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    mt: "1rem",
    maxWidth: 500,
  };
  const labelSx = { color: "secondary.dark" };

  const handleClick = (slug: string) => {
    if (onClick) {
      onClick(slug);
    }
  };

  if (!items?.length) {
    return null;
  }
  return (
    <Box sx={rootSx as React.CSSProperties}>
      {label && (
        <Typography sx={labelSx} variant="h6">
          {label}
        </Typography>
      )}
      <Box sx={filterContainerSx as React.CSSProperties}>
        {variant === "text"
          ? items.map((item) => (
              <Sort
                key={item.slug}
                onClick={handleClick}
                name={item.name}
                slug={item.slug}
              />
            ))
          : items.map((item) => (
              <Button
                active={undefined}
                key={item.slug}
                {...item}
                onClick={handleClick}
              />
            ))}
      </Box>
    </Box>
  );
}

export default Filter;
