"use client";
import AllInclusiveIcon from "@mui/icons-material/AllInclusive";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ControlPointIcon from "@mui/icons-material/ControlPoint";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import ShareIcon from "@mui/icons-material/Share";
import { Card, Grid, Button, Box, SxProps, Theme } from "@mui/material";
import { useState } from "react";

import BaseContent from "./BaseContent";
import Cards from "./cards";
import ConnectCard from "./ConnectCard";
import FollowCard from "./FollowCard";
import PetitionCard from "./PetitionCard";
import ShareCard from "./ShareCard";

interface ActNowButtonCardProps {
  title?: string;
  share?: any;
  connect?: any;
  petition?: any;
  follow?: any;
  update?: any;
  sx?: SxProps<Theme>;
}

function ActNowButtonCard(props: ActNowButtonCardProps) {
  const {
    share,
    title: actNowTitle = "Act Now",
    connect,
    petition,
    follow,
    update,
    sx,
  } = props;

  const [selectedCard, setSelectedCard] = useState(Cards.ACT);

  const selectCard = (name: keyof typeof Cards) => {
    setSelectedCard(Cards[name]);
  };

  const classes = {
    root: [
      {
        marginTop: "70px",
        padding: "0",
        borderRadius: "10px",
        boxShadow:
          "0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)",
        maxHeight: 210,
        width: "100%",
      },
      ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
    ] as SxProps<Theme>,
    buttonIcon: {
      display: {
        xs: "none",
        sm: "block",
      },
    },
    button: {
      padding: { xs: "20px 35px", sm: "30px 35px" },
      margin: { xs: "5px", sm: "8px" },
      borderRadius: "10px",
      backgroundColor: "#ebebeb",
      color: "#015dfd",
      marginTop: { sm: 0 },
      "&:hover": {
        backgroundColor: "#015dfd",
        color: "#ffffff",
      },
      "& .MuiButton-label": {
        display: "flex",
        flexDirection: "column",
      },
    },
  };
  return (
    <>
      <Card sx={classes.root}>
        {selectedCard === Cards.CONNECT && (
          <ConnectCard
            promiseActNow={connect}
            {...props}
            closeCard={() => selectCard("ACT")}
          />
        )}
        {selectedCard === Cards.FOLLOW && (
          <FollowCard
            promiseActNow={follow}
            {...props}
            closeCard={() => selectCard("ACT")}
          />
        )}
        {selectedCard === Cards.PETITION && (
          <PetitionCard
            promiseActNow={petition}
            {...props}
            closeCard={() => selectCard("ACT")}
          />
        )}
        {selectedCard === Cards.SHARE && (
          <ShareCard
            promiseActNow={{
              share: {
                shareTitle: share?.title,
                shareDescription: share?.description,
              },
            }}
            {...props}
            closeCard={() => selectCard("ACT")}
          />
        )}
        {selectedCard === Cards.ACT && (
          <BaseContent title={actNowTitle}>
            <Grid
              sx={{
                marginTop: "20px",
                flexDirection: { xs: "column", sm: "row" },
                display: "flex",
              }}
              justifyContent="center"
            >
              <Button
                // onClick={() => selectCard("CONNECT")}
                sx={classes.button}
                variant="contained"
              >
                <Box sx={classes.buttonIcon}>
                  <AllInclusiveIcon />
                </Box>
                <Box>{connect?.title}</Box>
              </Button>
              <Button
                // onClick={() => selectCard("PETITION")}
                sx={classes.button}
                variant="contained"
              >
                <Box sx={classes.buttonIcon}>
                  <ChatBubbleOutlineIcon />
                </Box>
                <Box>{petition?.title}</Box>
              </Button>
              <Button
                // onClick={() => selectCard("FOLLOW")}
                sx={classes.button}
                variant="contained"
              >
                <Box sx={classes.buttonIcon}>
                  <ControlPointIcon />
                </Box>
                <Box>{follow?.title}</Box>
              </Button>
              <Button sx={classes.button} variant="contained">
                <Box sx={classes.buttonIcon}>
                  <NotificationsNoneIcon />
                </Box>
                <Box>{update?.title}</Box>
              </Button>
              <Button
                onClick={() => selectCard("SHARE")}
                sx={classes.button}
                variant="contained"
              >
                <Box sx={classes.buttonIcon}>
                  <ShareIcon />
                </Box>
              </Button>
            </Grid>
          </BaseContent>
        )}
      </Card>
    </>
  );
}

export default ActNowButtonCard;
