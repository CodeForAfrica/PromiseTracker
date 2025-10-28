import { Grid } from "@mui/material";
import React from "react";

import BaseContent from "./BaseContent";
import CtAButton from "./CtaButton";
export interface ConnectCardProps {
  closeCard: () => void;
  promiseActNow?: {
    connect: {
      connectTitle?: string;
      connectDescription?: string;
      connectButton?: string;
    };
  };
}
function ConnectCard({
  closeCard,
  promiseActNow = {
    connect: {
      connectTitle: "",
      connectDescription: "",
      connectButton: "",
    },
  },
}: ConnectCardProps) {
  if (!promiseActNow.connect) return null;
  const {
    connect: { connectTitle, connectDescription, connectButton },
  } = promiseActNow;

  return (
    <BaseContent
      onCloseCard={closeCard}
      title={connectTitle}
      description={connectDescription}
    >
      <Grid>
        <CtAButton color="secondary">{connectButton}</CtAButton>
      </Grid>
    </BaseContent>
  );
}

export default ConnectCard;
