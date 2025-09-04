"use client";

import { Link, SvgIcon } from "@mui/material";
import React from "react";

const IconLink = React.forwardRef(function LinkIcon(
  { IconProps, children, ...props },
  ref,
) {
  return (
    <Link {...props} ref={ref}>
      <SvgIcon {...IconProps}> {children}</SvgIcon>
    </Link>
  );
});

export default IconLink;
