import { PromiseStatus } from "@/payload-types";
import { Chip, SxProps } from "@mui/material";
import React from "react";

interface Props extends PromiseStatus {
  sx?: SxProps;
}

function Status({ label, colors: { color, textColor } = {}, ...props }: Props) {
  const sx = {
    backgroundColor: color || "#909090",
    borderRadius: 0,
    color: textColor || "inherit",
    fontSize: { xs: 7, lg: 10 },
    fontWeight: 700,
    letterSpacing: { xs: 0.28, lg: 0.4 },
    lineHeight: { xs: 24 / 7, lg: 24 / 10 },
    mt: 2,
    textTransform: "uppercase",
    ...props.sx,
  } as SxProps;

  return <Chip label={label} sx={sx} />;
}

export default Status;
