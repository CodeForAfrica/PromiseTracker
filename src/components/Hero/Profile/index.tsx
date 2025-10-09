"use client";

import Image from "next/image";
import { Box, Typography } from "@mui/material";

type ProfileImage = {
  url: string;
  alt: string;
};

type ProfileProps = {
  name: string;
  fullName?: string;
  profileTitle: string;
  updatedAtLabel: string;
  updatedAtDisplay: string;
  image: ProfileImage | null;
};

const MOBILE_SIZE = 149;
const DESKTOP_SIZE = 350;

export const Profile = ({
  name,
  profileTitle,
  updatedAtLabel,
  updatedAtDisplay,
  image,
}: ProfileProps) => {
  const dateLine = [updatedAtLabel?.trim(), updatedAtDisplay]
    .filter(Boolean)
    .join(" ");

  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        flexDirection: { xs: "row", lg: "column" },
        gap: theme.typography.pxToRem(16),
        pt: { xs: theme.typography.pxToRem(20), lg: 0 },
        position: "relative",
        left: { xs: 0, lg: theme.typography.pxToRem(-55) },
      })}
    >
      <Box
        component="figure"
        sx={{
          m: 0,
          width: { xs: MOBILE_SIZE, lg: DESKTOP_SIZE },
          height: { xs: MOBILE_SIZE, lg: DESKTOP_SIZE },
          minWidth: { xs: MOBILE_SIZE, lg: DESKTOP_SIZE },
          minHeight: { xs: MOBILE_SIZE, lg: DESKTOP_SIZE },
          position: "relative",
          borderRadius: "50%",
          overflow: "hidden",
          backgroundColor: "secondary.light",
        }}
      >
        {image ? (
          <Image
            src={image.url}
            alt={image.alt || name}
            fill
            sizes={`(min-width: 1200px) ${DESKTOP_SIZE}px, ${MOBILE_SIZE}px`}
            style={{ objectFit: "cover" }}
            priority
          />
        ) : (
          <Box
            sx={(theme) => ({
              alignItems: "center",
              backgroundColor: theme.palette.secondary.main,
              color: theme.palette.text.primary,
              display: "flex",
              fontSize: theme.typography.pxToRem(48),
              fontWeight: 700,
              height: "100%",
              justifyContent: "center",
              width: "100%",
            })}
          >
            {name.charAt(0).toUpperCase()}
          </Box>
        )}
      </Box>
      <Box sx={{ minWidth: { xs: MOBILE_SIZE, lg: "auto" } }}>
        <Typography
          variant="h5"
          sx={(theme) => ({
            color: theme.palette.primary.main,
            textTransform: "uppercase",
            mb: theme.typography.pxToRem(6),
            whiteSpace: "nowrap",
          })}
        >
          {profileTitle}
        </Typography>
        {dateLine ? (
          <Typography
            variant="h6"
            sx={{
              color: "rgba(32, 32, 32, 0.35)",
              textTransform: "uppercase",
              mb: 0,
            }}
          >
            {dateLine}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
};

export default Profile;
