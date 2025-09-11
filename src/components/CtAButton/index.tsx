"use client";

import { Button, Container, SxProps, Theme } from "@mui/material";
import { PropsWithChildren } from "react";

type CtAButtonProps = PropsWithChildren<{
  href?: string;
  onClick?: () => void;
  className?: string;
  containerSx?: SxProps<Theme>;
  buttonSx?: SxProps<Theme>;
}>;

const CtAButton = ({ children, className, containerSx, buttonSx, ...props }: CtAButtonProps) => {
  return (
    <Container
      className={className}
      sx={[
        {
          display: "flex",
          justifyContent: "center",
          my: { xs: 4, lg: 5.5 },
        },
        containerSx,
      ]}
    >
      <Button
        variant="contained"
        {...props}
        sx={[
          {
            border: (t) => `1px solid ${t.palette.primary.main}`,
            minHeight: 48,
            minWidth: { xs: 98, lg: 158 },
            
            ":hover": {
              border: (t) => `1px solid ${t.palette.primary.main}`,
              background: (t) => t.palette.background.default,
              color: (t) => t.palette.text.primary,
            },
          },
          buttonSx,
        ]}
      >
        {children}
      </Button>
    </Container>
  );
};

export default CtAButton;
