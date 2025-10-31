import { CMSLinkType, CMSLink as Link } from "@/components/CMSLink";
import { Box, Button, Grid, Container, Typography } from "@mui/material";
import React from "react";
import PromiseCard from "@/components/PromiseCard";
import { Promise as P, PromiseStatus } from "@/payload-types";

type PromiseWithHref = P & { href?: string };

interface Props {
  items: PromiseWithHref[];
  title: string;
  seeAll: CMSLinkType;
}
const LatestPromises = ({ items, title, seeAll }: Props) => {
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
        {items.map((promise) => (
          <Grid
            key={promise.id}
            size={{
              xs: 12,
              lg: 4,
            }}
          >
            <PromiseCard
              image={
                typeof promise.image === "string" ? undefined : promise.image
              }
              title={promise.title ?? null}
              status={promise.status as PromiseStatus}
              description={promise.description ?? null}
              createdAt={promise.createdAt}
              href={promise.href ?? undefined}
            />
          </Grid>
        ))}
      </Grid>
      {seeAll && (
        <Link {...seeAll}>
          <Box display="flex" justifyContent="center" mt={4}>
            <Button
              variant="contained"
              sx={{
                background: "#000",
                color: "#fff",
                height: 48,
                "&:hover": {
                  background: "#fff",
                  color: "#000",
                  border: "1px solid #000",
                },
              }}
            >
              {seeAll.label}
            </Button>
          </Box>
        </Link>
      )}
    </Container>
  );
};

export default LatestPromises;
