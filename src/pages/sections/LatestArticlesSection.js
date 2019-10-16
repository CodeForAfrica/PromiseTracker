import React from 'react';
import { makeStyles, Typography, Button, Grid } from '@material-ui/core';
import Layout from '../../components/Layout';

import ArticleCard from '../../components/Articles/Cards/ArticleCard';
import ColumnArticleCard from '../../components/Articles/Cards/ColumnArticleCard';

import ArticleCardList from '../../components/Articles/Cards/ArticleCardList';
import ArticleCardListItem from '../../components/Articles/Cards/ArticleCardListItem';

import RouterLink from '../../components/RouterLink';

import data from '../../data/articles';

const useStyles = makeStyles({
  root: {
    padding: '4rem 0',
    background: 'white'
  },
  sectionTitle: {
    padding: '2rem 0'
  },
  mainGrid: {
    borderTop: '1px solid grey',
    padding: '2rem 0'
  },
  columnGrid: {
    borderLeft: '1px solid grey',
    padding: '0 1rem'
  },
  middleColumn: {
    borderTop: '2px solid grey',
    borderBottom: '2px solid grey'
  }
});

const articleSize = 4;
// data.articles.slice(1, articleSize).map(article => console.log(article.index === 2));

function LatestArticlesSection() {
  const classes = useStyles();
  return (
    <Layout justify="center" classes={{ root: classes.root }}>
      <Grid item xs={12} className={classes.sectionTitle}>
        <Typography variant="h4">Latest Articles</Typography>
      </Grid>
      <Grid
        container
        direction="row"
        spacing={5}
        style={{ borderTop: '1px solid grey', paddingTop: '2rem' }}
      >
        <Grid item xs={5}>
          <ArticleCardList>
            <ArticleCardListItem>
              {data.articles[0] ? (
                <ArticleCard
                  slug={data.articles[0].slug}
                  subtitle={data.articles[0].subtitle}
                  mediaSrc={data.articles[0].mediaSrc}
                  title={data.articles[0].title}
                  date={data.articles[0].date}
                />
              ) : (
                <null />
              )}
            </ArticleCardListItem>
          </ArticleCardList>
        </Grid>

        <Grid item xs={7} style={{ borderLeft: '1px solid grey' }}>
          <ArticleCardList>
            <ArticleCardListItem>
              {data.articles.slice(1, articleSize).map(article => (
                <ColumnArticleCard
                  slug={article.slug}
                  subtitle={article.subtitle}
                  mediaSrc={article.mediaSrc}
                  title={article.title}
                  date={article.date}
                />
              ))}
            </ArticleCardListItem>
          </ArticleCardList>
        </Grid>
      </Grid>

      <Grid item style={{ paddingTop: '3rem' }}>
        <Button
          classes={{ root: classes.readMore }}
          component={RouterLink}
          to="/articles"
          color="primary"
          variant="contained"
        >
          READ MORE
        </Button>
      </Grid>
    </Layout>
  );
}

export default LatestArticlesSection;
