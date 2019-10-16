import React from 'react';

import { Typography, Grid, makeStyles } from '@material-ui/core';
import propTypes from '../../propTypes';

import RouterLink from '../../RouterLink';

const useStyles = makeStyles(theme => ({
  img: {
    height: 'auto',
    maxWidth: '100%'
  },
  mainGrid: {
    padding: '1.5rem 0',
    borderBottom: `1px solid ${theme.palette.divider}`
  }
}));

function ColumnArticleCard({
  title,
  description,
  mediaSrc,
  subtitle,
  slug,
  date
}) {
  const classes = useStyles();
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const formattedDate = dateObj
    .toLocaleString('en-GB', {
      month: 'short',
      year: 'numeric',
      day: '2-digit'
    })
    .toString();
  return (
    <RouterLink to={`articles/${slug}`}>
      <Grid container direction="row" spacing={2} className={classes.mainGrid}>
        <Grid item xs={4}>
          <img
            src={mediaSrc}
            alt="Article Thumbnsail"
            className={classes.img}
          />
        </Grid>

        <Grid container item xs={8} direction="column" spacing={3}>
          <Grid item>
            <Typography variant="caption">{subtitle}</Typography>
            <Typography variant="h5">{title}</Typography>
            <Typography variant="body1">{description}</Typography>
          </Grid>
          <Grid item>
            <Typography variant="body2">{formattedDate}</Typography>
          </Grid>
        </Grid>
      </Grid>
    </RouterLink>
  );
}

ColumnArticleCard.propTypes = {
  mediaSrc: propTypes.string.isRequired,
  title: propTypes.string.isRequired,
  subtitle: propTypes.string.isRequired,
  description: propTypes.string,
  slug: propTypes.string.isRequired,
  date: propTypes.oneOfType([propTypes.string, propTypes.instanceOf(Date)])
    .isRequired
};

ColumnArticleCard.defaultProps = {
  description: undefined
};

export default ColumnArticleCard;
