import React from 'react';
import PropTypes from 'prop-types';
import { Grid, Typography, makeStyles } from '@material-ui/core';
import { Facebook, Instagram, Twitter, Send } from 'react-feather';



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
})

function SocialMedia() {
  const classes = useStyles();
  return (
    <Grid item xs={12} md={4}>
      <Typography variant="h3" style={{ color: 'black' }}>ON SOCIAL MEDIA</Typography>
      <Grid
        spacing={3}
        container
        direction="row"
        justify="flex-start"
        alignItems="center"
        className={classes.iconGrid}>
        <Grid item>
          <a
            href="https://www.facebook.com/AfricanCIR/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Facebook className={classes.fa} />
          </a>
        </Grid>
        <Grid item>
          <a
            href="https://www.instagram.com/explore/tags/onsgrond/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Instagram className={classes.fa} />
          </a>
        </Grid>
        <Grid item>
          <a
            href="https://twitter.com/africancir"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Twitter className={classes.fa} />
          </a>
        </Grid>
        <Grid item>
          <a
            href="https://telegram.me/RouhaniMeter"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Send className={classes.fa} />
          </a>
        </Grid>
      </Grid>
    </Grid>
  );
}

SocialMedia.propTypes = {
  classes: PropTypes.shape().isRequired
};

export default SocialMedia;
