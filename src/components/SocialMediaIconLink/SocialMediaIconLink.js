"use client";

import React from "react";

import IconLink from "./IconLink";
import { Box } from "@mui/material";

import FacebookIcon from "@/assets/icons/Type=facebook, Size=24, Color=CurrentColor.svg";
import GitHubIcon from "@/assets/icons/Type=github, Size=24, Color=CurrentColor.svg";
import InstagramIcon from "@/assets/icons/Type=instagram, Size=24, Color=CurrentColor.svg";
import LinkedInIcon from "@/assets/icons/Type=linkedin, Size=24, Color=CurrentColor.svg";
import SlackIcon from "@/assets/icons/Type=slack, Size=24, Color=CurrentColor.svg";
import TwitterIcon from "@/assets/icons/Type=twitter, Size=24, Color=CurrentColor.svg";

const platformToIconMap = {
  Facebook: FacebookIcon,
  Twitter: TwitterIcon,
  Instagram: InstagramIcon,
  Linkedin: LinkedInIcon,
  Github: GitHubIcon,
  Slack: SlackIcon,
};

const SocialMediaIconLink = React.forwardRef(function SocialMediaIconLink(
  { IconProps, children: childrenProp, href, platform, ...props },
  ref,
) {
  if (!href?.length) {
    return null;
  }

  let children = childrenProp;
  if (!children) {
    const Icon = platform && platformToIconMap[platform];
    if (Icon) {
      children = <Icon />;
    }
  }

  if (!children) {
    return null;
  }
  return (
    <Box
      bgcolor="common.white"
      display="flex"
      justifyContent="center"
      alignItems="center"
      sx={{ width: 48, height: 48 }}
    >
      <IconLink
        color="common.black"
        {...props}
        href={href}
        IconProps={{
          sx: {
            fill: "none",
          },
        }}
        sx={{
          display: "flex",
          pr: "10px",
          ":last-of-type": {
            pr: 0,
          },
          ...props?.sx,
        }}
        ref={ref}
      >
        {children}
      </IconLink>
    </Box>
  );
});

export default SocialMediaIconLink;
