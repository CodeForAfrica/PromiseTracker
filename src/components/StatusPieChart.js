import React, { useState } from 'react';
import { PieChart, Pie, Cell, LabelList } from 'recharts';

import { Grid, Typography, makeStyles } from '@material-ui/core';

const statusColors = {
  achieved: 'rgb(50, 112, 174)',
  compromised: 'rgb(112, 68, 135)',
  'in-progress': 'rgb(38, 143, 130)',
  'not-achieved': 'rgb(221, 87, 84)',
  stalled: 'rgb(216, 159, 67)',
  inactive: 'rgb(141, 141, 141)'
};

const promises = [
  {
    status: 'achieved',
    name: 'Achieved',
    value: 400
  },
  {
    status: 'compromised',
    name: 'Compromised',
    value: 300
  },
  {
    status: 'in-progress',
    name: 'In Progress',
    value: 300
  },
  {
    status: 'not-achieved',
    name: 'Not Achieved',
    value: 200
  },
  {
    status: 'stalled',
    name: 'Stalled',
    value: 278
  },
  {
    status: 'inactive',
    name: 'Inactive',
    value: 189
  }
];

const totalPromises = promises.reduce((a, b) => a + b.value, 0);

function PercentageLabelFormatter(value) {
  return `${((Number(value) * 100) / totalPromises).toFixed(0)}%`;
}

const useStyles = makeStyles({
  root: {
    position: 'relative'
  },
  centerText: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0
  }
});

function StatusPieChart() {
  const classes = useStyles();
  const [activeData, setActiveData] = useState(null);
  const onMouseEnter = data => {
    setActiveData(data);
  };
  const onMouseLeave = () => {
    setActiveData(null);
  };
  return (
    <div className={classes.root}>
      <Grid
        container
        direction="column"
        justify="center"
        alignItems="center"
        className={classes.centerText}
      >
        <Typography>{activeData ? activeData.value : totalPromises}</Typography>
        {activeData && <Typography>{activeData.name}</Typography>}
        <Typography>Promises</Typography>
      </Grid>
      <PieChart width={255} height={255}>
        <Pie
          isAnimationActive={false}
          data={promises}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={60}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {promises.map(promise => (
            <Cell key={promise.status} fill={statusColors[promise.status]} />
          ))}
          <LabelList
            dataKey="value"
            position="insideTop"
            formatter={PercentageLabelFormatter}
          />
        </Pie>
      </PieChart>
    </div>
  );
}

export default StatusPieChart;
