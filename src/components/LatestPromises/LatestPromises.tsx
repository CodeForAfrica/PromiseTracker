import { CMSLink as Link } from "@/components/CMSLink";
import { Box, Button, Grid, Container } from "@mui/material";
import React, { forwardRef } from "react";
import PromiseCard from "@/components/PromiseCard";

interface Props {
  actionLabel?: string;
  items: Array<{
    title: string;
    status: {
      title: string;
      label: string;
      color: string;
    };
    href?: string;
    image?: string;
  }>;
  title: string;
}
const LatestPromises: React.FC<Props> = forwardRef(function LatestPromises({
  actionLabel,
  items,
  title,
  ...props
}) {
  if (!items?.length) {
    return null;
  }
  return (
    <Container
      sx={{
        pt: 12,
        pb: 8,
      }}
      title={title}
    >
      <Grid container spacing={3.75}>
        {items.map((promise) => (
          <Grid
            key={promise.title}
            size={{
              xs: 12,
              lg: 4,
            }}
          >
            <PromiseCard {...promise} status={promise.status} />
          </Grid>
        ))}
      </Grid>
      {actionLabel && (
        <Link
          url="/promises"
          sx={{
            textDecoration: "none",
            "&:hover": {
              textDecoration: "none",
            },
          }}
        >
          <Box display="flex" justifyContent="center" mt={4}>
            <Button
              variant="contained"
              sx={{
                background: "#000",
                color: "#fff",
                height: 48,
              }}
            >
              {actionLabel}
            </Button>
          </Box>
        </Link>
      )}
    </Container>
  );
});

export default LatestPromises;
