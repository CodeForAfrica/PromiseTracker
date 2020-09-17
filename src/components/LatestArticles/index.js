import React from "react";
import PropTypes from "prop-types";

import { useMediaQuery } from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";

import { ScrollBar, Section } from "@commons-ui/core";

import ArticleCard from "@/promisetracker/components/ArticleCard";
import CtAButton from "@/promisetracker/components/CtAButton";

import useStyles from "./useStyles";

function LatestArticles({ actionLabel, items, title, ...props }) {
  const classes = useStyles(props);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));

  if (!items?.length) {
    return null;
  }
  return (
    <Section
      title={title}
      classes={{ root: classes.section, title: classes.sectionTitle }}
    >
      <div className={classes.root}>
        <ScrollBar
          autoHide
          classes={{ root: classes.scrollBar }}
          height={isDesktop ? 462 : 500}
        >
          <div className={classes.cardContainer}>
            {items.map((article) => (
              <ArticleCard key={article.name} {...article} component="div" />
            ))}
          </div>
        </ScrollBar>
      </div>
      {actionLabel && (
        <CtAButton classes={{ root: classes.cta, button: classes.ctaButton }}>
          {actionLabel}
        </CtAButton>
      )}
    </Section>
  );
}

LatestArticles.propTypes = {
  actionLabel: PropTypes.string,
  classes: PropTypes.shape({
    card: PropTypes.string,
    scrollBar: PropTypes.string,
    section: PropTypes.string,
    sectionTitle: PropTypes.string,
    root: PropTypes.string,
  }),
  items: PropTypes.arrayOf(PropTypes.shape({})),
  title: PropTypes.string,
};

LatestArticles.defaultProps = {
  actionLabel: undefined,
  classes: undefined,
  items: undefined,
  title: undefined,
};

export default LatestArticles;
