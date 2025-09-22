"use client";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Grid,
  SvgIcon,
  SxProps,
  Typography,
} from "@mui/material";
import React, { FC } from "react";

import Share from "@/components/Share";
import ShareIcon from "@/assets/share-icon.svg";
import site from "@/utils/site";
import { Media, PromiseStatus } from "@/payload-types";

interface Props {
  as?: React.ElementType;
  createdAt?: string;
  description?: string;
  image?: Media | null;
  title?: string | null;
  imageSx?: SxProps;
  children?: React.ReactNode;
  href?: string;
  sx?: SxProps;
  status: PromiseStatus;
}

const PostCard: FC<Props> = function PostCard({
  children,
  as,
  createdAt,
  description,
  image,
  title,
  imageSx,
  status,
  ...props
}) {
  const date = new Date(createdAt ?? "").toISOString().split("T")[0];
  const rootSx = {
    minWidth: 314,
    maxHeight: 510,
    height: 510,
    width: "100%",
    overflow: "hidden",
    boxSizing: "border-box",
    "@media (min-width:1200px)": {
      marginRight: 21.5,
      maxHeight: 510,
      minWidth: "auto",
      overflow: "visible",
      "&:last-of-type": { marginRight: 0 },
    },
    "&:hover": {
      boxShadow: "rgba(0, 0, 0, 0.1) 0px 0px 4px 4px",
      borderTopColor: `${status.colors?.color}`,
    },
    ...props.sx,
  };
  const contentSx = { p: 0 };
  const contentRootSx = {
    height: 510,
    p: 2,
    borderTop: "8px solid transparent",
    "&:hover": {
      borderTopColor: `${status.colors?.color}`,
    },
  };
  const dateSx = {
    lineHeight: 1.4,
    margin: "1rem 0",
    opacity: 0.59,
  };
  const descriptionContainerSx = {
    height: 72,
    mt: { xs: 1.5, lg: 3 },
    maxHeight: 72,
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
  const mediaSx = {
    backgroundSize: "cover",
    display: "block",
    height: { xs: 185, lg: 210 },
    maxWidth: { xs: 277, lg: "100%" },
    width: "auto",
    ...imageSx,
  };
  const shareSx = { position: "absolute", right: 0, zIndex: 999 };
  const socialLinkSx = { margin: 0 };
  const titleContainerSx = {
    height: 44,
    maxHeight: 44,
    overflow: "hidden",
    alignItems: "flex-start",
  };
  const shareIconSx = { color: "#909090" };

  return (
    <Card square variant="outlined" sx={rootSx as SxProps}>
      <CardActionArea
        {...(as ? { component: as } : {})}
        {...props}
        sx={contentRootSx}
      >
        <CardContent sx={contentSx}>
          <Box display="flex" alignItems="flex-end" sx={titleContainerSx}>
            <Typography variant="h4">{title}</Typography>
          </Box>
          <Grid
            sx={{ height: 46 }}
            alignItems="center"
            container
            justifyContent="space-between"
          >
            <Grid>
              <Typography variant="h6" sx={dateSx}>
                {date}
              </Typography>
            </Grid>
            <Grid>
              <Share
                sx={shareSx}
                socialLinkSx={socialLinkSx}
                link={site.url + (as || "")}
                title={title ?? ""}
                {...props}
              >
                <SvgIcon
                  fontSize="inherit"
                  sx={shareIconSx}
                  component={ShareIcon}
                />
              </Share>
            </Grid>
          </Grid>
        </CardContent>
        {image?.url ? (
          <CardMedia
            component="div"
            image={image.url}
            title={title ?? ""}
            sx={mediaSx}
          />
        ) : null}
        {children}
        {description && (
          <CardContent sx={contentSx}>
            <Box display="flex" sx={descriptionContainerSx}>
              <Typography variant="body2">{description}</Typography>
            </Box>
          </CardContent>
        )}
      </CardActionArea>
    </Card>
  );
};

export default PostCard;
