import React from "react";
import { Container, Typography, Box } from "@material-ui/core";
import Copyright from "@/promisetracker/components/Copyright";
import TypographySetup from "@/promisetracker/components/TypographySetup";
import Newsletter from "@/promisetracker/components/Newsletter";
import Footer from "@/promisetracker/components/Footer";
import config from "@/promisetracker/config";

export default function Index() {
  return (
    <>
      <Container maxWidth="sm">
        <Box my={4}>
          <Typography variant="h4" gutterBottom>
            Next.js theme setup
          </Typography>
          <TypographySetup />
          <Copyright />
        </Box>
      </Container>
      <Newsletter />
      <Footer page={config.page} />
    </>
  );
}
