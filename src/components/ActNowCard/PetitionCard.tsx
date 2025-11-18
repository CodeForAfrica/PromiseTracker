import { Box, Snackbar } from "@mui/material";
import Alert from "@mui/material/Alert";
import React, { useState } from "react";

import BaseContent from "./BaseContent";

import CtAButton from "./CtaButton";

interface PetitionCardProps {
  closeCard: () => void;
  petitionJoin?: string;
  petitionTitle?: string;
  promiseActNow?: {
    petition: {
      petitionTitle?: string;
      petitionDescription?: string;
    };
  };
  // Additional props for FormDialog
  [key: string]: any;
}

function PetitionCard({
  closeCard,
  promiseActNow = {
    petition: { petitionTitle: "", petitionDescription: "" },
  },
  ...props
}: PetitionCardProps) {
  const [success, setSuccess] = useState(false);

  if (!promiseActNow.petition) return null;
  const {
    petition: { petitionTitle, petitionDescription },
  } = promiseActNow;

  const { petitionJoin, petitionTitle: petitionStart } = props;

  const handleSnackbarClose = () => {
    setSuccess(false);
  };

  return (
    <BaseContent
      onCloseCard={closeCard}
      title={petitionTitle}
      description={petitionDescription}
    >
      <Box sx={{ flexWrap: "wrap" }} display="flex" justifyContent="center">
        <CtAButton color="secondary">{petitionStart}</CtAButton>
        <CtAButton color="secondary">{petitionJoin}</CtAButton>
        <Snackbar open={success}>
          <Alert onClose={handleSnackbarClose} severity="success">
            Petition successfully created!
          </Alert>
        </Snackbar>
      </Box>
    </BaseContent>
  );
}

export default PetitionCard;
