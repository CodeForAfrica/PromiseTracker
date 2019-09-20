import React from 'react';
import { Grid, Typography, makeStyles } from '@material-ui/core';
import propTypes from '../propTypes';

const useStyles = makeStyles(theme => ({
  root: {
    textAlign: 'center',
    [theme.breakpoints.up('md')]: {
      textAlign: 'unset',
      justifyContent: 'flex-start'
    }
  },
  content: {
    [theme.breakpoints.up('md')]: {
      justifyContent: 'flex-start'
    }
  }
}));

function Section({ title, children, spacing, direction }) {
  const classes = useStyles();
  return (
    <Grid
      className={classes.root}
      container
      direction="column"
      justify="center"
      spacing={3}
    >
      <Grid item>
        <Typography variant="h3">{title}</Typography>
      </Grid>
      <Grid
        container
        item
        xs={12}
        spacing={spacing}
        direction={direction}
        justift="center"
        className={classes.content}
      >
        {children}
      </Grid>
    </Grid>
  );
}

Section.propTypes = {
  title: propTypes.string,
  children: propTypes.children.isRequired,
  spacing: propTypes.number,
  direction: propTypes.string
};

Section.defaultProps = {
  title: undefined,
  spacing: undefined,
  direction: undefined
};

export default Section;
