"use client";

import Image from "next/image";
import {
  Box,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

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

const resolveImageSize = (isDesktop: boolean) =>
  isDesktop ? DESKTOP_SIZE : MOBILE_SIZE;

export const Profile = ({
  name,
  profileTitle,
  updatedAtLabel,
  updatedAtDisplay,
  image,
}: ProfileProps) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const size = resolveImageSize(isDesktop);

  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        flexDirection: isDesktop ? "column" : "row",
        gap: theme.typography.pxToRem(16),
        pt: isDesktop ? 0 : theme.typography.pxToRem(20),
        position: "relative",
        [theme.breakpoints.up("lg")]: {
          left: theme.typography.pxToRem(-55),
        },
      })}
    >
      <Box
        component="figure"
        sx={{
          m: 0,
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
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
            sizes={isDesktop ? `${DESKTOP_SIZE}px` : `${MOBILE_SIZE}px`}
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
      <Box sx={{ minWidth: isDesktop ? "auto" : MOBILE_SIZE }}>
        <Typography
          variant="h5"
          sx={(theme) => ({
            color: theme.palette.primary.main,
            textTransform: "uppercase",
            mb: theme.typography.pxToRem(6),
          })}
        >
          {profileTitle}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: "rgba(32, 32, 32, 0.35)" }}
        >
          {updatedAtLabel} {updatedAtDisplay}
        </Typography>
      </Box>
    </Box>
  );
};

export default Profile;
