import React from "react";
import PropTypes from "prop-types";

import { makeStyles } from "@material-ui/core/styles";

import ActNow from "@/promisetracker/components/ActNow";
import { getSitePage } from "@/promisetracker/cms";
import config from "@/promisetracker/config";
import ContentPage from "@/promisetracker/components/ContentPage";
import FAQ from "@/promisetracker/components/FAQ";

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
  footer: {
    marginTop: 0,
  },
}));

function Index({ errorCode, faqs, page, actNow, ...props }) {
  const {
    title: { rendered: pageTitle },
  } = page;

  const classes = useStyles(props);

  return (
    <ContentPage
      slug="faq"
      title={pageTitle}
      classes={{ section: classes.section, footer: classes.footer }}
      content={<FAQ items={faqs} />}
      contentProps={{
        lg: 8,
      }}
    >
      <ActNow classes={{ section: classes.section }} />
    </ContentPage>
  );
}

export async function getStaticProps() {
  const lang = config.DEFAULT_LANG;
  const page = await getSitePage("faq", lang);
  const faqs = page.page.faqs
    .reduce((arr, e) => arr.concat(e.questions_answers), [])
    .map((faq) => ({ title: faq.question, summary: faq.answer }));

  const errorCode = null;
  return {
    props: {
      errorCode,
      page: page.page,
      actNow: page.page.actNow,
      faqs,
    },
  };
}

Index.propTypes = {
  page: PropTypes.shape({
    title: PropTypes.shape({
      rendered: PropTypes.string,
    }),
    actNow: PropTypes.shape({}),
  }),
  faqs: PropTypes.shape({}),
  errorCode: PropTypes.number,
  actNow: PropTypes.shape({}),
  subscribe: PropTypes.shape({}),
};
Index.defaultProps = {
  page: undefined,
  errorCode: undefined,
  actNow: undefined,
  subscribe: undefined,
  faqs: undefined,
};

export default Index;
