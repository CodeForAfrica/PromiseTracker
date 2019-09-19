import React from 'react';

import { Grid, makeStyles } from '@material-ui/core';
import { Facebook, Instagram, Twitter, Send } from 'react-feather';

import A from '../A';
import Section from './Section';

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

function SocialMedia() {
  const classes = useStyles();
  return (
    <Section title="ON SOCIAL MEDIA" spacing={2}>
      <Grid item>
        <A
          href="https://www.facebook.com/AfricanCIR/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Facebook className={classes.fa} />
        </A>
      </Grid>
      <Grid item>
        <A
          href="https://www.instagram.com/explore/tags/onsgrond/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Instagram className={classes.fa} />
        </A>
      </Grid>
      <Grid item>
        <A
          href="https://twitter.com/africancir"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Twitter className={classes.fa} />
        </A>
      </Grid>
      <Grid item>
        <A
          href="https://twitter.com/africancir"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Send className={classes.fa} />
        </A>
      </Grid>
    </Section>
  );
}

export default SocialMedia;
