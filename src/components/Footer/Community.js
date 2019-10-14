import React from 'react';

import classNames from 'classnames';

import { makeStyles, Typography } from '@material-ui/core';

import A from '../A';

const useStyles = makeStyles({
  root: {
    width: '100%'
  },
  listText: {
    // match parent width
    width: '100%'
  },
  list: {
    listStyleType: 'none',
    padding: 0,
    marginTop: '0'
  },
  joinText: {
    paddingTop: '1.5rem'
  }
});

function Community(props) {
  const classes = useStyles(props);
  const joinClassName = classNames(classes.listText, classes.joinText);

  return (
    <div classes={classes.root}>
      <Typography
        variant="subtitle1"
        className={classes.listText}
        component="div"
      >
        Other openAFRICA Projects
        <ul className={classes.list}>
          <li>
            <A
              href="https://taxclock.codeforkenya.org/"
              className={classes.links}
            >
              Tax Clock
            </A>
          </li>
          <li>
            <A href="https://hurumap.org/" className={classes.links}>
              HURUmap
            </A>
          </li>
        </ul>
      </Typography>
      <Typography variant="subtitle1" className={joinClassName} component="div">
        Join Our Community
        <ul className={classes.list}>
          <li>
            <A
              href="https://www.facebook.com/HacksHackersAfrica"
              className={classes.links}
            >
              Hacks/Hackers Africa
            </A>
          </li>
        </ul>
      </Typography>
    </div>
  );
}

export default Community;
