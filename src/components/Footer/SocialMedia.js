import React from 'react';

import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faFacebookF,
  faInstagram,
  faTwitter,
  faTelegram
} from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { Grid, Typography, makeStyles } from '@material-ui/core';

const useStyles = makeStyles({
  iconGrid: {
    padding: '2.5rem 0'
  },
  fa: {
    transition: 'all .5s ease-in-out',
    color: 'grey',
    ' &:hover': {
      color: '#257ca3'
    }
  },
  links: { color: '#fff' }
});

library.add(faFacebookF, faTwitter, faInstagram, faTelegram);

function SocialMedia() {
  const classes = useStyles();
  return (
    <Grid item xs={12} md={4}>
      <Typography variant="h3" style={{ color: 'black' }}>
        ON SOCIAL MEDIA
      </Typography>
      <Grid
        spacing={3}
        container
        direction="row"
        justify="flex-start"
        alignItems="center"
        className={classes.iconGrid}
      >
        <Grid item>
          <a
            href="https://www.facebook.com/AfricanCIR/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FontAwesomeIcon
              className={classes.fa}
              icon={['fab', 'facebook-f']}
              size="2x"
            />
          </a>
        </Grid>
        <Grid item>
          <a
            href="https://www.instagram.com/explore/tags/onsgrond/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FontAwesomeIcon
              className={classes.fa}
              icon={['fab', 'instagram']}
              size="2x"
            />
          </a>
        </Grid>
        <Grid item>
          <a
            href="https://twitter.com/africancir"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FontAwesomeIcon
              className={classes.fa}
              icon={['fab', 'twitter']}
              size="2x"
            />
          </a>
        </Grid>
        <Grid item>
          <a
            href="https://twitter.com/africancir"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FontAwesomeIcon
              className={classes.fa}
              icon={['fab', 'telegram']}
              size="2x"
            />
          </a>
        </Grid>
      </Grid>
    </Grid>
  );
}

export default SocialMedia;
