import { CssBaseline } from "@material-ui/core";
import { ThemeProvider } from "@material-ui/core/styles";
import { DefaultSeo } from "next-seo";
import PropTypes from "prop-types";
import React from "react";

import theme from "@/promisetracker/theme/index";
import SEO from "next-seo.config";

import "leaflet/dist/leaflet.css";
// simplebar-react has a hard dependency on simplebar
// eslint-disable-next-line import/no-extraneous-dependencies
import "simplebar/dist/simplebar.css";

export default function MyApp(props) {
  const { Component, pageProps } = props;
  React.useEffect(() => {
    // Remove the server-side injected CSS.
    const jssStyles = document.querySelector("#jss-server-side");
    if (jssStyles) {
      jssStyles.parentElement.removeChild(jssStyles);
    }
  }, []);

  return (
    <>
      <DefaultSeo {...SEO} />
      <ThemeProvider theme={theme}>
        {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
        <CssBaseline />
        <Component {...pageProps} />
      </ThemeProvider>
    </>
  );
}

MyApp.propTypes = {
  Component: PropTypes.elementType.isRequired,
  pageProps: PropTypes.shape({}).isRequired,
};
