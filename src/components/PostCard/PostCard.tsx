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

interface Props {
  as?: React.ElementType;
  date?: string;
  description?: string;
  image?: {
    url: string;
    alt?: string;
  };
  title?: string;
  imageSx?: SxProps;
  children?: React.ReactNode;
  href?: string;
  sx?: SxProps;
}

const PostCard: FC<Props> = function PostCard({
  children,
  as,
  date,
  description,
  image,
  title,
  imageSx,
  ...props
}) {
  const rootSx = {
    border: "1px solid #EBEBEB",
    minWidth: 314,
    maxHeight: 510,
    width: "100%",
    "@media (min-width:1200px)": {
      marginRight: 21.5,
      maxHeight: 510,
      minWidth: "auto",
      overflow: "visible",
      "&:last-of-type": { marginRight: 0 },
    },
    ...props.sx,
  };
  const contentSx = { p: 0 };
  const contentRootSx = {
    height: "100%",
    padding: "2rem 1rem",
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
    backgroundSize: "contain",
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
    <Card square variant="outlined" sx={rootSx}>
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
                title={title}
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
            title={title}
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
