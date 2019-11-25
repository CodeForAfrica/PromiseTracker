import React from 'react';

import {
  Typography,
  Grid,
  makeStyles,
  Card,
  CardMedia,
  CardContent
} from '@material-ui/core';

import propTypes from 'components/propTypes';

const useStyles = makeStyles(theme => ({
  root: {
    margin: '1rem'
  },
  img: {
    height: 0,
    paddingTop: '56%'
  },
  a: {
    color: theme.palette.primary.main,
    textDecoration: 'none'
  },
  content: {
    marginBottom: '1.5rem'
  }
}));

function ArticleCard({
  title,
  description,
  image,
  subtitle,
  uniqueSlug,
  date
}) {
  const classes = useStyles();
  const timestamp = new Date(date);
  const formattedDate = timestamp
    .toLocaleString('en-US', {
      month: 'short',
      year: 'numeric',
      day: '2-digit'
    })
    .toString();
  console.log('BOOM', { date, formattedDate });
  return (
    <Card component={Grid} item xs={12} sm={4} className={classes.root}>
      <a
        href={`https://pesacheck.org/${uniqueSlug}`}
        target="_blank"
        rel="noopener noreferrer"
        className={classes.a}
      >
        <CardMedia
          alt="Article Thumbnail"
          image={image}
          className={classes.img}
        />
        <CardContent>
          <div className={classes.content}>
            <Typography variant="caption"> {subtitle}</Typography>
            <Typography variant="h5">{title}</Typography>
            <Typography variant="body1">{description}</Typography>
          </div>
          <Typography variant="body2">{formattedDate}</Typography>
        </CardContent>
      </a>
    </Card>
  );
}

ArticleCard.propTypes = {
  image: propTypes.string.isRequired,
  title: propTypes.string.isRequired,
  subtitle: propTypes.string.isRequired,
  description: propTypes.string,
  uniqueSlug: propTypes.string.isRequired,
  date: propTypes.oneOfType([
    propTypes.string,
    propTypes.instanceOf(Date),
    propTypes.number // nanoseconds
  ]).isRequired
};

ArticleCard.defaultProps = {
  description: undefined
};

export default ArticleCard;
