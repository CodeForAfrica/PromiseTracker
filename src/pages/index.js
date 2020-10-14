import React from "react";

import { makeStyles } from "@material-ui/core/styles";
import { gql } from "@apollo/client";

import createApolloClient from "@/promisetracker/lib/createApolloClient";

import Hero from "@/promisetracker/components/Hero";
import ActNow from "@/promisetracker/components/ActNow";
import KeyPromises from "@/promisetracker/components/KeyPromises";
import LatestArticles from "@/promisetracker/components/LatestArticles";
import LatestPromises from "@/promisetracker/components/LatestPromises";
import Page from "@/promisetracker/components/Page";
import Partners from "@/promisetracker/components/Partners";
import Subscribe from "@/promisetracker/components/Newsletter";

import articleImage from "@/promisetracker/assets/article-thumb-01.png";
import config from "@/promisetracker/config";
import promiseCarouselImage from "@/promisetracker/assets/promise-carusel-01.png";
import promiseImage from "@/promisetracker/assets/promise-thumb-01.png";

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
  heroSection: {
    padding: `0 ${typography.pxToRem(23)}`,
    margin: 0,
    width: "100%",
    [breakpoints.up("lg")]: {
      padding: 0,
      margin: "0 auto",
      width: typography.pxToRem(widths.values.lg + 100),
    },
  },
}));

const GET_TEAMS = gql`
  query {
    team(slug: "pesacheck-promise-tracker") {
      id
      name
      dbid
    }
  }
`;

function Index(props) {
  const classes = useStyles(props);
  // console.log(props.promises)
  return (
    <Page classes={{ section: classes.section }}>
      <Hero classes={{ heroSection: classes.heroSection }} />
      <KeyPromises
        actionLabel="Learn More"
        items={Array(6)
          .fill(null)
          .map((_, i) => ({
            date: "2019-08-10",
            description: `
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer euismod odio non leo pretium pellentesque. Curabitur blandit urna cursus, malesuada erat ut, egestas odio. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer euismod odio non leo pretium pellentesque. Curabitur blandit urna cursus, malesuada erat ut, egestas odio.
            `,
            image: promiseCarouselImage,
            title: `Codification of national sports and athletics law ${i + 1}`,
            status: config.promiseStatuses[i % config.promiseStatuses.length],
          }))}
        title="Key Promises"
        classes={{
          section: classes.section,
        }}
      />
      <LatestPromises
        actionLabel="See All"
        items={Array(6)
          .fill(null)
          .map((_, i) => ({
            date: "2019-08-10",
            description: `
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer
              euismod odio non leo pretium pellentesque.
            `,
            image: promiseImage,
            status: config.promiseStatuses[i % config.promiseStatuses.length],
            title: "Codification of national sports and athletics law",
          }))}
        title="Latest Promises"
        classes={{
          section: classes.section,
        }}
      />
      <ActNow
        classes={{
          section: classes.section,
        }}
      />
      <LatestArticles
        actionLabel="See All"
        items={Array(6).fill({
          date: "2019-08-10",
          description: `
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer
              euismod odio non leo pretium pellentesque.
            `,
          image: articleImage,
          title: "Codification of national sports and athletics law",
        })}
        title="Latest Articles"
        classes={{
          section: classes.section,
        }}
      />
      <Partners
        classes={{
          section: classes.section,
        }}
      />
      <Subscribe
        classes={{
          section: classes.section,
        }}
      />
    </Page>
  );
}

export async function getStaticProps() {
  const apolloClient = createApolloClient();

  await apolloClient.query({
    query: GET_TEAMS,
  });

  return {
    props: {
      promises: apolloClient.cache.extract(),
    },
    revalidate: 1,
  };
}

export default Index;
