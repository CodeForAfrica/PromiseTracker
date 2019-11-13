import React, { useCallback, useState, useEffect } from 'react';

import { makeStyles } from '@material-ui/styles';
import { useRouter, Router } from 'next/router';
import { Grid, Button } from '@material-ui/core';
import propTypes from '../propTypes';

import Layout from '../Layout';
import Select from '../Select';
import PromiseCard from '../Promise/Card';

import data from '../../data';

const useStyles = makeStyles({
  root: props => ({
    background: props.color || 'rgb(246, 246, 246)',
    padding: '2rem 0rem 4.125rem'
  }),
  cardsContainer: {
    padding: '2rem 0rem',
    margin: '0 0.5rem'
  },
  mainGrid: {
    margin: '0 0.5rem'
  },
   button: { paddingTop: '3rem' }
});

function PromisesSection({
  filter: propsFilter,
  location,
  history,
  disableFilterHistory,
  ...props
}) {
  const classes = useStyles(props);
  const router = useRouter();

  const [filter, setFilter] = useState({
    status: propsFilter.status || 'all',
    term: propsFilter.term || 'all',
    topic: propsFilter.topic || 'all'
  });

  const updateFilter = useCallback(
    (name, value) => {
      setFilter({ ...filter, [name]: value });
      const params = new URLSearchParams(router.asPath.split(/\?/)[1]);

      if (value !== 'all') {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      if (!disableFilterHistory) {
        router.push(`/?${params.toString()}`, filter);
      }
    },
    [disableFilterHistory, filter, history, location]
  );

  useEffect(() => {
    function updateFilterWithQueryOnBack() {
      // important: use window.location instead of router location
      // window.location has the route we went back to

      //Disclamer : Please disregard the above comment 😔😔🙅🏾‍♀️🙅🏾...
      //We are using Router because we all know that next.js routing is SONIC 🦔 in real life
      const params = new URLSearchParams(router.asPath);
      if (
        (params.get('status') || 'all') !== filter.status ||
        (params.get('term') || 'all') !== filter.term ||
        (params.get('topic') || 'all') !== filter.topic
      ) {
        setFilter({
          status: params.get('status') || 'all',
          term: params.get('term') || 'all',
          topic: params.get('topic') || 'all'
        });
      }
    }
    window.addEventListener('popstate', updateFilterWithQueryOnBack);
    return () => {
      window.removeEventListener('popstate', updateFilterWithQueryOnBack);
    };
  }, [filter]);

  const filtersQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (filter.status !== 'all') {
      params.set('status', filter.status);
    }
    if (filter.term !== 'all') {
      params.set('term', filter.term);
    }

    if (filter.topic !== 'all') {
      params.set('topic', filter.topic);
    }
    return params.toString();
  }, [filter.status, filter.term, filter.topic]);

  const { promises } = data;
  return (
    <Layout justify="center" classes={{ root: classes.root }}>
      <Grid
        container
        justify="flex-start"
        direction="row"
        spacing={4}
        className={classes.mainGrid}
      >
        <Grid item xs={6} sm={4} md={2}>
          <Select
            showIndicator={filter.status !== 'all'}
            value={filter.status}
            onChange={value => updateFilter('status', value)}
            options={[
              {
                value: 'all',
                name: 'All Statuses'
              },
              ...data.statusTypes.map(status => ({
                name: status.name,
                value: status.slug
              }))
            ]}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Select
            showIndicator={filter.term !== 'all'}
            value={filter.term}
            onChange={value => updateFilter('term', value)}
            options={[
              {
                value: 'all',
                name: 'All Terms'
              },
              ...data.terms.map(term => ({
                name: term.name,
                value: term.slug
              }))
            ]}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Select
            showIndicator={filter.topic !== 'all'}
            value={filter.topic}
            onChange={value => updateFilter('topic', value)}
            options={[
              {
                value: 'all',
                name: 'All Topics'
              },
              ...data.topics.map(topic => ({
                name: topic.name,
                value: topic.slug
              }))
            ]}
          />
        </Grid>
      </Grid>

      <Grid
        container
        className={classes.cardsContainer}
        spacing={2}
        color="white"
      >
        {promises
          .filter(
            filterPromise =>
              (filter.status === 'all' ||
                filterPromise.status === filter.status) &&
              (filter.term === 'all' || filterPromise.term === filter.term) &&
              (filter.topic === 'all' || filterPromise.topic === filter.topic)
          )
          .map(promise => (
            <Grid item xs={12} sm={6} md={4}>
              <PromiseCard
                href={`promise/${promise.slug}`}
                status={promise.status}
                title={promise.title}
                term={data.terms.find(s => s.slug === promise.term).name}
                topic={data.topics.find(s => s.slug === promise.topic).name}
              />
            </Grid>
          ))}
      </Grid>
    
      <Grid item className={classes.button}>
        <Button
          variant="contained"
          href={`/promises?${filtersQueryString()}`}
          color="primary"
        >
          SHOW MORE
        </Button>
      </Grid>
  
    </Layout>
  );
}

PromisesSection.propTypes = {
  disableFilterHistory: propTypes.bool,
  location: propTypes.location.isRequired,
  filter: propTypes.shape({
    status: propTypes.string,
    term: propTypes.string,
    topic: propTypes.string
  })
};

PromisesSection.defaultProps = {
  disableFilterHistory: false,
  filter: {
    status: undefined,
    term: undefined,
    topic: undefined
  }
};

export default PromisesSection;
