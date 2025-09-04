import Image from "next/image";
import React from "react";
import { Link } from "@mui/material";

function Logo({ image, url, ...props }) {
  return (
    <Link
      href={url}
      sx={{
        display: "flex",
        position: "relative",
        width: { xs: "189.59px", lg: "183.54px" },
        height: { xs: "107.85px", lg: "97.12px" },
      }}
    >
      <Image alt="Logo" {...image} fill sx={{ objectFit: "contain" }} />
    </Link>
  );
}

export default Logo;
