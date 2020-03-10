import React from 'react';

import { Typography, Grid } from '@material-ui/core';

import { useRouter } from 'next/router';

import { Facebook, Twitter } from 'react-feather';
import { FacebookShareButton, TwitterShareButton } from 'react-share';

import propTypes from 'components/propTypes';
import StatusChip from 'components/Promise/StatusChip';

function PromiseHeader({ status, title, term, topic }) {
  const router = useRouter();
  const statusAndShareSectionId = 'statusAndShareSection';
  const shareUrl = router.query.id;
  return (
    <Grid container direction="column" justify="space-between" spacing={4}>
      <Grid item>
        <Typography variant="h4" style={{ color: 'black' }}>
          {title}
        </Typography>
      </Grid>

      <Grid item>
        <Typography variant="body2">
          {term} | {topic}
        </Typography>
      </Grid>

      <Grid
        id={statusAndShareSectionId}
        item
        container
        direction="row"
        justify="space-between"
        wrap="nowrap"
      >
        <Grid item>
          <StatusChip status={status} style={{ color: 'white' }} />
        </Grid>
        <Grid container item justify="flex-end" spacing={2} xs={6} sm={4}>
          <Grid item>
            <Typography variant="body1">Share:</Typography>
          </Grid>
          <Grid item>
            <FacebookShareButton
              className="Mui-share"
              url={shareUrl}
              style={{ color: '#0067a3' }}
            >
              <Facebook
                className="Mui-desaturated"
                style={{ fill: '#0067a3' }}
              />
            </FacebookShareButton>
          </Grid>
          <Grid item>
            <TwitterShareButton
              className="Mui-share"
              url={shareUrl}
              style={{ color: '#0067a3' }}
            >
              <Twitter
                className="Mui-desaturated"
                style={{ fill: '#0067a3' }}
              />
            </TwitterShareButton>
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
}

PromiseHeader.propTypes = {
  status: propTypes.oneOf([
    'complete',
    'behind-schedule',
    'unstarted',
    'in-progress',
    'stalled',
    'inconclusive',
    ''
  ]).isRequired,
  title: propTypes.string.isRequired,
  term: propTypes.string.isRequired,
  topic: propTypes.string.isRequired
};

export default PromiseHeader;
