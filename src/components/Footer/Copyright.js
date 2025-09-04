import { Typography, Button, Box } from "@mui/material";
import React from "react";
import Figure from "@/components/Figure";
import Link from "@/components/Link";

function Copyright({
  children,
  typographyProps = { variant: "button" },
  menu = [],
  ...props
}) {
  return (
    <Box
      display="flex"
      alignItems="center"
      flexDirection={{
        xs: "column",
        sm: "row",
      }}
      flexWrap="wrap"
    >
      {menu?.map((item, index) => (
        <Button
          key={item.label}
          component={item.href ? Link : "button"}
          href={item.href}
          sx={{
            backgroundColor: "transparent",
            border: "none",
            boxShadow: "none",
            "&:hover": { backgroundColor: "transparent" },
          }}
        >
          {index === 0 ? (
            <Figure
              ImageProps={{
                alt: "Copyright",
                src: props.src,
              }}
              sx={{ width: "19px", height: "19px" }}
            />
          ) : null}

          <Typography
            {...typographyProps}
            sx={{
              color: "#a4a4a4",
              py: { xs: 2, sm: 0 },
            }}
            variant="button"
          >
            {item.label}
          </Typography>
        </Button>
      ))}
    </Box>
  );
}

export default Copyright;
