import { TextField, Grid, Box } from "@mui/material";
import React from "react";

import BaseContent from "./BaseContent";

import CtAButton from "./CtaButton";

interface FollowCardProps {
  closeCard: () => void;
  promiseActNow?: {
    follow: {
      followTitle?: string;
      followDescription?: string;
      followButton?: string;
    };
  };
}
function FollowCard({
  closeCard,
  promiseActNow = { follow: {} },
}: FollowCardProps) {
  if (!promiseActNow.follow) return null;
  const {
    follow: { followTitle, followDescription, followButton },
  } = promiseActNow;

  return (
    <BaseContent
      title={followTitle}
      description={followDescription}
      onCloseCard={closeCard}
    >
      <Grid>
        <Box
          component="form"
          sx={{
            display: "flex",
            justifyContent: "center",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: "center",
            marginTop: { xs: "10px", sm: "30px" },
          }}
        >
          <TextField
            id="outlined-basic"
            label="example@mail.com"
            variant="outlined"
            sx={{
              margin: { xs: "10px", sm: 0 },
              width: { sm: "400px" },
              "& .MuiOutlinedInput-root": {
                borderRadius: "0px",
                border: "none",
              },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "#005DFD",
                borderWidth: "2px",
              },
              "& .MuiInputLabel-outlined": {
                color: "#8f8f8f",
                top: {
                  xs: 0,
                  lg: "-10px",
                },
              },
            }}
          />
          <CtAButton
            color="primary"
            sx={{
              margin: "0 0 10px 0",
              height: "58px",
              width: "auto",
              color: "white",
              "& :hover": {
                backgroundColor: "#015dfd",
              },
            }}
          >
            {followButton}
          </CtAButton>
        </Box>
      </Grid>
    </BaseContent>
  );
}

export default FollowCard;
