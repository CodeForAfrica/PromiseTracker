import React from "react";
import PropTypes from "prop-types";

import { makeStyles } from "@material-ui/core/styles";

import Hero from "@/promisetracker/components/Hero";
import ActNow from "@/promisetracker/components/ActNow";
import KeyPromises from "@/promisetracker/components/KeyPromises";
import LatestArticles from "@/promisetracker/components/LatestArticles";
import LatestPromises from "@/promisetracker/components/LatestPromises";
import Page from "@/promisetracker/components/Page";
import Partners from "@/promisetracker/components/Partners";
import Subscribe from "@/promisetracker/components/Newsletter";

import check from "@/promisetracker/lib/check";
import { groupPromisesByStatus } from "@/promisetracker/utils";
import i18n from "@/promisetracker/lib/i18n";
import wp from "@/promisetracker/lib/wp";

import articleImage from "@/promisetracker/assets/article-thumb-01.png";

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

function Index({
  actNow,
  criteria,
  footer,
  navigation,
  partners,
  promiseStatuses,
  promises,
  keyPromises,
  promisesByStatus,
  subscribe,
  ...props
}) {
  const classes = useStyles(props);
  return (
    <Page
      {...props}
      footer={footer}
      navigation={navigation}
      classes={{ section: classes.section, footer: classes.footer }}
    >
      <Hero
        promisesByStatus={promisesByStatus}
        criteria={criteria}
        name="Mike “Sonko” Mbuvi"
        position="Nairobi Governor"
        title="Campaign promises made by Mike Mbuvi"
        classes={{ section: classes.section }}
      />
      <KeyPromises
        actionLabel="Learn More"
        items={keyPromises}
        title="Key Promises"
        classes={{
          section: classes.section,
        }}
      />
      <LatestPromises
        actionLabel="See All"
        items={promises.slice(0, 6)}
        title="Latest Promises"
        classes={{
          section: classes.section,
        }}
      />
      <ActNow
        {...actNow}
        classes={{
          section: classes.section,
        }}
      />
      <LatestArticles
        actionLabel="See All"
        items={Array(6)
          .fill(null)
          .map((_, i) => ({
            date: "2019-08-10",
            description: `
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer
              euismod odio non leo pretium pellentesque.
            `,
            image: articleImage,
            title: `Codification of national sports and athletics law ${i + 1}`,
          }))}
        title="Latest Articles"
        classes={{
          section: classes.section,
        }}
      />
      <Partners
        {...partners}
        title="Partners"
        classes={{
          section: classes.section,
        }}
      />
      <Subscribe
        {...subscribe}
        classes={{
          section: classes.section,
        }}
      />
    </Page>
  );
}

Index.propTypes = {
  actNow: PropTypes.shape({}),
  criteria: PropTypes.shape({}),
  footer: PropTypes.shape({}),
  navigation: PropTypes.shape({}),
  partners: PropTypes.shape({}),
  promiseStatuses: PropTypes.arrayOf(PropTypes.shape({})),
  promises: PropTypes.arrayOf(PropTypes.shape({})),
  keyPromises: PropTypes.arrayOf(PropTypes.shape({})),
  promisesByStatus: PropTypes.arrayOf(PropTypes.shape({})),
  subscribe: PropTypes.shape({}),
};

Index.defaultProps = {
  actNow: undefined,
  criteria: undefined,
  footer: undefined,
  navigation: undefined,
  partners: undefined,
  promiseStatuses: undefined,
  promises: undefined,
  keyPromises: undefined,
  promisesByStatus: undefined,
  subscribe: undefined,
};

export async function getStaticProps({ locale }) {
  // Skip generating pages for unsuported locales
  if (!i18n().locales.includes(locale)) {
    return {
      notFound: true,
    };
  }

  const page = await wp().pages({ slug: "index", locale }).first;
  const { promiseStatuses } = page;
  const checkApi = check({
    promiseStatuses,
    team: "pesacheck-promise-tracker",
  });
  const promises = await checkApi.promises({
    limit: 10000,
    query: `{ "projects": ["2831"] }`,
  });
  const keyPromises = await checkApi.promises({
    limit: 6,
    query: `{ "projects": ["4691"] }`,
  });

  return {
    props: {
      ...page,
      promises: promises.slice(0, 6),
      keyPromises,
      promisesByStatus: groupPromisesByStatus(promises),
    },
    revalidate: 2 * 60, // seconds
  };
}

export default Index;
