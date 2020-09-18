import React from "react";

import { makeStyles } from "@material-ui/core/styles";

import ActNow from "@/promisetracker/components/ActNow";
import KeyPromises from "@/promisetracker/components/KeyPromises";
import LatestArticles from "@/promisetracker/components/LatestArticles";
import LatestPromises from "@/promisetracker/components/LatestPromises";
import Page from "@/promisetracker/components/Page";
import Partners from "@/promisetracker/components/Partners";
import Subscribe from "@/promisetracker/components/Newsletter";

import articleImage from "@/promisetracker/assets/article-thumb-01.png";
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
}));

function Index(props) {
  const classes = useStyles(props);

  return (
    <Page>
      <KeyPromises
        actionLabel="Learn More"
        items={Array(6).fill({
          date: "2019-08-10",
          description: `
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer euismod odio non leo pretium pellentesque. Curabitur blandit urna cursus, malesuada erat ut, egestas odio. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer euismod odio non leo pretium pellentesque. Curabitur blandit urna cursus, malesuada erat ut, egestas odio.
            `,
          image: promiseCarouselImage,
          title: "Codification of national sports and athletics law",
        })}
        title="Key Promises"
        classes={{
          section: classes.section,
        }}
      />
      <LatestPromises
        actionLabel="See All"
        items={Array(6).fill({
          date: "2019-08-10",
          description: `
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer
              euismod odio non leo pretium pellentesque.
            `,
          image: promiseImage,
          status: {
            color: "#FFB322",
            textColor: "#202020",
            title: "delayed",
          },
          title: "Codification of national sports and athletics law",
        })}
        title="Latest Promises"
        classes={{
          section: classes.section,
        }}
      />
      <ActNow />
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
      <Partners />
      <Subscribe />
    </Page>
  );
}

export default Index;
