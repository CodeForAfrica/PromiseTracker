"use client";

import React from "react";
import NextLink from "next/link";
import { IconButton, type SxProps, type Theme, SvgIcon } from "@mui/material";

import type { SiteSetting } from "@/payload-types";

import FacebookIcon from "@/assets/icons/Type=facebook, Size=24, Color=CurrentColor.svg";
import GitHubIcon from "@/assets/icons/Type=github, Size=24, Color=CurrentColor.svg";
import InstagramIcon from "@mui/icons-material/Instagram";
import LinkedInIcon from "@/assets/icons/Type=linkedin, Size=24, Color=CurrentColor.svg";
import SlackIcon from "@/assets/icons/Type=slack, Size=24, Color=CurrentColor.svg";
import TwitterIcon from "@/assets/icons/Type=twitter, Size=24, Color=CurrentColor.svg";

export type Platform = NonNullable<
  SiteSetting["connect"]["links"]
>[number]["platform"];

const platformToIconMap = {
  Facebook: FacebookIcon,
  Twitter: TwitterIcon,
  Instagram: InstagramIcon,
  Linkedin: LinkedInIcon,
  Github: GitHubIcon,
  Slack: SlackIcon,
};

type Props = {
  platform: Platform;
  href: string;
  sx?: SxProps<Theme>;
};

export const SocialMediaIconLink: React.FC<Props> = ({
  platform,
  href,
  sx,
}) => {
  const Icon = platformToIconMap[platform];
  return Icon ? (
    <IconButton
      component={NextLink}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        borderRadius: 0,
        backgroundColor: "#fff",
        "&:hover": {
          backgroundColor: "#fff",
        },
        ...sx,
      }}
    >
      <SvgIcon component={Icon} />
    </IconButton>
  ) : null;
};

export default SocialMediaIconLink;
