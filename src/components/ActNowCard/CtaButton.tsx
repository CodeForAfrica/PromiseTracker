import { Button, Container } from "@mui/material";
import React from "react";

function CtAButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Container
      sx={() => ({
        display: "flex",
        justifyContent: "center",
        margin: { xs: "33px 0", lg: "45px 0" },
      })}
    >
      <Button
        variant="contained"
        {...props}
        sx={({ palette }) => ({
          border: `1px solid ${palette.primary.main}`,
          minHeight: "48px",
          minWidth: { xs: "98px", lg: "158px" },
          "&:hover": {
            border: `1px solid ${palette.primary.main}`,
            background: palette.background.default,
            color: palette.text.primary,
          },
        })}
      />
    </Container>
  );
}

export default CtAButton;
