import React from "react";
import PropTypes from "prop-types";

import Error from "next/error";
import { NextSeo } from "next-seo";
import Footer from "@/promisetracker/components/Footer";
import config from "@/promisetracker/config";

function Page({ children, errorCode, ...props }) {
  if (errorCode) {
    return <Error statusCode={errorCode} />;
  }

  return (
    <>
      <NextSeo {...props} />
      {children}
      <Footer page={config.page} />
    </>
  );
}

Page.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
  errorCode: PropTypes.number,
};

Page.defaultProps = {
  errorCode: undefined,
};

export default Page;
