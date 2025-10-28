import CloseIcon from "@mui/icons-material/Close";
import { CardContent, Typography, Grid } from "@mui/material";
import React from "react";

interface Props {
  onCloseCard?: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
}

function BaseCard({ onCloseCard, title, description, children }: Props) {
  return (
    <CardContent
      sx={{
        padding: 0,
      }}
    >
      {onCloseCard && (
        <CloseIcon
          onClick={onCloseCard}
          sx={{
            position: "relative",
            top: "30px",
            left: "90%",
            color: "#c7c7c7",
          }}
        />
      )}
      {title && (
        <Grid
          sx={{
            pt: onCloseCard ? 0 : 4,
          }}
        >
          <Typography align="center" variant="h4">
            {title}
          </Typography>
        </Grid>
      )}
      {description && (
        <Grid>
          <Typography
            align="center"
            variant="body2"
            sx={{
              fontSize: "15px",
              margin: { xs: "10px", sm: 0 },
            }}
          >
            {description}
          </Typography>
        </Grid>
      )}
      {children}
    </CardContent>
  );
}

export default BaseCard;
