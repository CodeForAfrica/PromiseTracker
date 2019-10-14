import React from 'react';
import { Grid, Typography, makeStyles } from '@material-ui/core';

import KeyboardArrowRight from '@material-ui/icons/KeyboardArrowRight';
import KeyboardArrowLeft from '@material-ui/icons/KeyboardArrowLeft';

import RouterLink from '../RouterLink';
import propTypes from '../propTypes';

const useStyles = makeStyles({
  root: {
    borderTop: '0.0625rem solid #9b9b9b',
    padding: '1.25rem 0'
  }
});

function ArticleNav({ next, previous }) {
  const classes = useStyles();
  return (
    <Grid
      className={classes.root}
      container
      justify="space-between"
      spacing={1}
    >
      {/* We need to keep the item component even when there is not previous
          component to ensure proper positioning of next item
       */}
      <Grid item xs={6} md={5}>
        {previous && (
          <RouterLink to={previous.href} color="#659db9">
            <KeyboardArrowLeft />
            <Typography variant="body1">{previous.label}</Typography>
          </RouterLink>
        )}
      </Grid>
      {next && (
        <Grid container item xs={6} md={5} justify="flex-end">
          <RouterLink to={next.href} color="#659db9">
            <Typography variant="body1">{next.label}</Typography>
            <KeyboardArrowRight />
          </RouterLink>
        </Grid>
      )}
    </Grid>
  );
}

ArticleNav.propTypes = {
  next: propTypes.shape({
    label: propTypes.string,
    href: propTypes.string
  }),
  previous: propTypes.shape({
    label: propTypes.string,
    href: propTypes.string
  })
};

ArticleNav.defaultProps = {
  next: undefined,
  previous: undefined
};

export default ArticleNav;
