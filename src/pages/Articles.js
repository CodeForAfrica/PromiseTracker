import React, { useMemo } from 'react';

import { Button, Grid, withWidth } from '@material-ui/core';
import propTypes from '../components/propTypes';

import Page from '../components/Page';

import Layout from '../components/Layout';

import ArticleCard from '../components/Articles/ArticleCard';

import RouterLink from '../components/RouterLink';

import data from '../data/articles';

function Articles({ location: { search } }) {
  const params = new URLSearchParams(search);
  const offsetParam = params.get('offset');
  const offset = useMemo(() => Number(offsetParam) || 0, [offsetParam]);
  const articles = {
    offset,
    data: data.articles
  };

  return (
    <Page>
      <Layout justify="center">
        <Grid container spacing={5}>
          <Grid item>
            <Grid container spacing={2}>
              {!articles.offset && (
                <Grid item xs={12}>
                  {articles.data[0] && (
                    <ArticleCard
                      slug={articles.data[0].slug}
                      subtitle={articles.data[0].subtitle}
                      mediaSrc={articles.data[0].mediaSrc}
                      title={articles.data[0].title}
                      date={articles.data[0].date}
                      description="August 2019 marks the sixth anniversary of Hassan Rouhani’s presidency. His sixth year in office was a difficult one, both for him and for the people of Iran. The economic and political crises that began earlier seem to continue into his seventh year. "
                    />
                  )}
                </Grid>
              )}
              {articles.data.slice(1).map(article => (
                <Grid item xs={12} md={4}>
                  <ArticleCard
                    slug={article.slug}
                    subtitle={article.subtitle}
                    mediaSrc={article.mediaSrc}
                    title={article.title}
                    date={article.date}
                  />
                </Grid>
              ))}
            </Grid>
          </Grid>

          <Grid item xs={12} style={{ textAlign: 'center' }}>
            <Button
              component={RouterLink}
              to={`/articles?offset=${offset + 1}`}
              color="primary"
              variant="contained"
            >
              READ MORE
            </Button>
          </Grid>
        </Grid>
      </Layout>
    </Page>
  );
}

Articles.propTypes = {
  location: propTypes.shape({
    search: propTypes.string
  }).isRequired
};

export default withWidth()(Articles);
