"use client";

/* eslint-env browser */

import CuiRichTypography from "@/components/RichTypography";
import React from "react";

const RichTypography = React.forwardRef(function RichTypography(
  { LinkProps, ...props },
  ref,
) {
  const onClick = (e) => {};

  return (
    <CuiRichTypography
      {...props}
      LinkProps={{ onClick, ...LinkProps }}
      ref={ref}
    />
  );
});

export default RichTypography;
