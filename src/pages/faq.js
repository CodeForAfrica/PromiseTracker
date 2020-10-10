import React from "react";
import PropTypes from "prop-types";

import { makeStyles } from "@material-ui/core/styles";

import Page from "@/promisetracker/components/Page";
import FAQ from "@/promisetracker/components/FAQ";
import ActNow from "@/promisetracker/components/ActNow";
import { getSitePage } from "@/promisetracker/cms";
import config from "@/promisetracker/config";

const useStyles = makeStyles(({ breakpoints, typography, widths }) => ({
  section: {
    padding: `0 ${typography.pxToRem(23)}`,
    margin: 0,
    width: "100%",
    [breakpoints.up("lg")]: {
      padding: 0,
      margin: "0 auto",
      width: typography.pxToRem(widths.values.lg),
    },
  },
}));

function Index({ errorCode, promiseTracker, ...props }) {
  const {
    page: {
      faqs: propsFAQ,
      title: { rendered: pageTitle },
    },
  } = promiseTracker;
  const faqs = propsFAQ.reduce((arr, e) => arr.concat(e.questions_answers), []);
  const classes = useStyles(props);

  return (
    <Page
      errorCode={errorCode}
      promiseTracker={promiseTracker}
      title={pageTitle}
      classes={{ section: classes.section }}
    >
      <FAQ faqs={faqs} classes={{ section: classes.section }} />
      <ActNow classes={{ section: classes.section }} />
    </Page>
  );
}

export async function getStaticProps({ query }) {
  const { lang: pageLanguage } = query;
  const lang = pageLanguage || config.DEFAULT_LANG;
  const promiseTracker = await getSitePage("faq", lang);
  const errorCode = null;

  return {
    props: {
      errorCode,
      promiseTracker,
    },
  };
}

Index.propTypes = {
  promiseTracker: PropTypes.shape({
    page: PropTypes.shape({
      faqs: PropTypes.shape({}),
      title: PropTypes.shape({
        rendered: PropTypes.string,
      }),
    }),
  }),
  errorCode: PropTypes.number,
};
Index.defaultProps = {
  promiseTracker: undefined,
  errorCode: undefined,
};

export default Index;
