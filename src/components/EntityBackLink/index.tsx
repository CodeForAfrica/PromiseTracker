"use client";

import NextLink from "next/link";
import {
  Avatar,
  Box,
  Typography,
  type SxProps,
  type Theme,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import type { Media } from "@/payload-types";

type EntityBackLinkProps = {
  href: string;
  name: string;
  image?: Media | null;
  sx?: SxProps<Theme>;
};

const EntityBackLink = ({ href, name, image, sx }: EntityBackLinkProps) => {
  const avatarSrc = image && typeof image !== "string" ? image.url ?? undefined : undefined;
  const fallbackInitial = name?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <Box
      component={NextLink}
      href={href}
      aria-label={`Back to ${name}`}
      sx={[
        {
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          textDecoration: "none",
          color: "#005DFD",
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <ArrowBackIosNewRoundedIcon
        sx={(theme) => ({ fontSize: theme.typography.pxToRem(16) })}
      />
      <Avatar
        src={avatarSrc}
        alt={name}
        sx={{
          width: 36,
          height: 36,
          fontSize: "0.875rem",
          fontWeight: 600,
          textTransform: "uppercase",
          border: "1px solid #005DFD",
        }}
      >
        {fallbackInitial}
      </Avatar>
      <Typography
        variant="body2"
        component="span"
        sx={{ fontWeight: 600, textTransform: "uppercase" }}
      >
        {name}
      </Typography>
    </Box>
  );
};

export default EntityBackLink;
