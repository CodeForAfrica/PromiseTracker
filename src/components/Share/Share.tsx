"use client";
import {
  Grid,
  Fade,
  Paper,
  Popper,
  IconButton,
  SvgIcon,
  ClickAwayListener,
  PopperPlacementType,
} from "@mui/material";
import React from "react";
import {
  FacebookShareButton,
  LinkedinShareButton,
  TwitterShareButton,
} from "react-share";

import FacebookIcon from "@/assets/footer-social-fb.svg";
import LinkedInIcon from "@/assets/footer-social-ln.svg";
import TwitterIcon from "@/assets/footer-social-tw.svg";

interface Props {
  link: string;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

function Share({ link, title, description, children, ...props }: Props) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const [placement, setPlacement] = React.useState<PopperPlacementType>("top");
  const [open, setOpen] = React.useState(false);

  const handleClick =
    (newPlacement: PopperPlacementType) =>
    (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      setAnchorEl(event?.currentTarget);
      setOpen((prev) => placement !== newPlacement || !prev);
      setPlacement(newPlacement);
    };

  const handleClickAway = () => {
    setOpen(false);
  };

  const rootSx = { zIndex: 999, marginRight: "0.2rem" };
  const shareSx = {
    fontSize: "1rem",
    textAlign: "center",
    "&:hover": { cursor: "pointer" },
  };
  const popperSx = { marginTop: "10px" };
  const socialIconPopperSx = { padding: "0.5rem" };
  const socialLinkSx = {
    display: "inline-flex",
    padding: "0.5rem !important",
  };
  const svgIconSx = { width: "1rem", height: "1rem" };

  return (
    <div style={rootSx}>
      <IconButton
        onClick={handleClick("left")}
        aria-label="share"
        sx={shareSx}
        disableFocusRipple
        disableRipple
        size="large"
      >
        {children}
      </IconButton>
      <Popper
        open={open}
        anchorEl={anchorEl}
        disablePortal
        placement={placement}
        transition
        sx={popperSx}
      >
        {({ TransitionProps }) => (
          <ClickAwayListener onClickAway={handleClickAway}>
            <Fade {...TransitionProps} timeout={350}>
              <Paper>
                <Grid container sx={socialIconPopperSx}>
                  <TwitterShareButton
                    title={title}
                    url={link}
                    style={socialLinkSx}
                  >
                    <SvgIcon
                      component={TwitterIcon}
                      viewBox="0 0 20 16"
                      alt="Twitter"
                      sx={svgIconSx}
                    />
                  </TwitterShareButton>
                  <FacebookShareButton
                    title={title}
                    url={link}
                    style={socialLinkSx}
                  >
                    <SvgIcon
                      component={FacebookIcon}
                      viewBox="0 0 10 20"
                      alt="Facebook"
                      sx={svgIconSx}
                    />
                  </FacebookShareButton>
                  <LinkedinShareButton
                    title={title}
                    url={link}
                    source={link}
                    style={socialLinkSx}
                  >
                    <SvgIcon
                      component={LinkedInIcon}
                      viewBox="0 0 15.288 15.287"
                      alt="LinkedIn"
                      sx={svgIconSx}
                    />
                  </LinkedinShareButton>
                </Grid>
              </Paper>
            </Fade>
          </ClickAwayListener>
        )}
      </Popper>
    </div>
  );
}

export default Share;
