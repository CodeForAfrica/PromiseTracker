import React from 'react';
import { makeStyles } from '@material-ui/styles';
import {
  Grid,
  Typography,
  FormControl,
  FormLabel,
  TextField,
  Button
} from '@material-ui/core';
import Layout from '../../components/Layout';

const useStyles = makeStyles({
  root: {
    height: '28.375rem',
    background:
      'linear-gradient(to right, #f7b801, #f7b801 50%, #f6f6f6 50%, #f6f6f6)'
  },
  contributeForm: {
    width: '499px',
    '& > div': {
      marginBottom: '1.3125rem'
    },
    '& .MuiInputBase-input': {
      color: '#637381'
    }
  },
  descriptionTextField: {
    height: '8.375rem'
  },
  contributeCallToAction: {
    '& h2:nth-child(1)': {
      marginBottom: '.875rem'
    },
    '& h3:nth-child(2)': {
      marginBottom: '1.75rem'
    }
  }
});

function ContributeSection() {
  const classes = useStyles();
  return (
    <div className={classes.root}>
      <Layout justify="center" alignItems="center">
        <Grid className={classes.contributeCallToAction} item xs={6}>
          <Typography variant="h2">Contibute</Typography>
          <Typography variant="h3">
            Have you spotted a promise in action?
          </Typography>
          <Typography>
            See something wrong? Share data to help assess a promise!
          </Typography>
        </Grid>
        <Grid container item xs={6} justify="flex-end">
          <form className={classes.contributeForm}>
            <FormControl fullWidth>
              <FormLabel htmlFor="description">Description</FormLabel>
              <TextField
                multiline
                id="description"
                className={classes.descriptionTextField}
              />
            </FormControl>
            <FormControl fullWidth>
              <FormLabel htmlFor="source">Source</FormLabel>
              <TextField id="source" />
            </FormControl>
            <Button>Submit</Button>
          </form>
        </Grid>
      </Layout>
    </div>
  );
}

export default ContributeSection;
