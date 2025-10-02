import { CMSLink as Link } from "@/components/CMSLink";
import { Box, Button, Grid, Container, Typography } from "@mui/material";
import React, { forwardRef } from "react";
import PromiseCard from "@/components/PromiseCard";
import { Promise as P, PromiseStatus } from "@/payload-types";

interface Props {
  actionLabel?: string;
  items: P[];
  title: string;
  promisePageLink?: string;
}
const LatestPromises: React.FC<Props> = forwardRef(function LatestPromises({
  actionLabel,
  items,
  title,
  promisePageLink,
}) {
  if (!items?.length) {
    return null;
  }
  return (
    <Container
      sx={{
        pt: { xs: 6, lg: 12 },
        pb: { xs: 6, lg: 8 },
      }}
    >
      <Typography
        component="h2"
        variant="h2"
        sx={{
          textAlign: { xs: "center", lg: "left" },
          textTransform: "capitalize",
        }}
      >
        {title}
      </Typography>
      <Grid container spacing={2}>
        {items.map((promise: P) => (
          <Grid
            key={promise.title}
            size={{
              xs: 12,
              lg: 4,
            }}
          >
            <PromiseCard
              {...promise}
              image={
                typeof promise.image === "string" ? undefined : promise.image
              }
              title={promise.title ?? null}
              status={promise.status as PromiseStatus}
            />
          </Grid>
        ))}
      </Grid>
      {actionLabel && (
        <Link
          url={promisePageLink}
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
